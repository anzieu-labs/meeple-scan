import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { AutoRefresh } from "@/components/stats/auto-refresh";
import { statsAccess } from "@/lib/stats/auth";
import { readStats, WINDOWS, type Totals } from "@/lib/stats/queries";

export const metadata: Metadata = { title: "Stats", robots: { index: false, follow: false } };

/** How often the open page reads the numbers again. */
const REFRESH_SECONDS = 30;

const n = new Intl.NumberFormat("fr-FR");
// French puts a non-breaking space before %.
const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}\u00a0%` : "–");
const WINDOW_NAMES: Record<(typeof WINDOWS)[number], string> = { 1: "Aujourd'hui", 7: "7 jours", 30: "30 jours" };

/**
 * The owner's private stats, behind a password (proxy.ts, `STATS_PASSWORD`): visits and where they come
 * from, photos, installs, recognition, feedback. Read from Postgres on every visit and every 30 seconds.
 */
export default function StatsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 text-[#103b2c] sm:px-8">
      <Suspense fallback={<p className="py-20 text-center text-sm text-[#103b2c]/60">Lecture des stats…</p>}>
        <Stats />
      </Suspense>
    </main>
  );
}

async function Stats() {
  await connection();
  // The proxy already asked for the password; the page checks it too, in case a request reaches it another way.
  if (statsAccess((await headers()).get("authorization")) !== "ok") notFound();
  const s = await readStats();
  const [today, week, month] = s.windows;
  const maxDay = Math.max(1, ...s.days.map((d) => d.visits));
  const maxLang = Math.max(1, ...s.languages.map((l) => l.visits));
  const time = new Date(s.readAt).toLocaleTimeString("fr-FR", { timeZone: "America/Toronto" });

  const metrics: { label: string; hint?: string; value: (t: Totals) => string }[] = [
    { label: "Visites", value: (t) => n.format(t.visits) },
    { label: "…sur téléphone", value: (t) => `${n.format(t.phone)} (${pct(t.phone, t.visits)})` },
    { label: "Visites qui ont scanné", hint: "part des visites sur téléphone", value: (t) => `${n.format(t.scannedVisits)} (${pct(t.scannedVisits, t.phone)})` },
    { label: "Photos envoyées", value: (t) => `${n.format(t.photos)}${t.gallery ? ` (${n.format(t.gallery)} galerie)` : ""}` },
    { label: "Installations", value: (t) => n.format(t.installs) },
    { label: "Photos lues", hint: "photo logs, tests compris", value: (t) => n.format(t.logged) },
    { label: "…bon jeu confirmé", value: (t) => `${n.format(t.markedRight)} (${pct(t.markedRight, t.logged)})` },
    { label: "…corrigées", value: (t) => `${n.format(t.corrected)} (${pct(t.corrected, t.logged)})` },
    { label: "…rien trouvé", value: (t) => `${n.format(t.nothingFound)} (${pct(t.nothingFound, t.logged)})` },
    { label: "Feedbacks", value: (t) => n.format(t.feedback) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={REFRESH_SECONDS} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Stats Meeple Scan</h1>
          <p className="text-sm text-[#103b2c]/70">
            {n.format(month.visits)} visites en 30 jours, dont {pct(month.scannedVisits, month.phone)} des visites sur téléphone qui ont scanné.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-[#103b2c]/60">
          <span className="size-2 animate-pulse rounded-full bg-[#00875a] motion-reduce:animate-none" aria-hidden />
          En direct · lu à {time} (Montréal) · toutes les {REFRESH_SECONDS} s
        </p>
      </header>

      <Card title="Chiffres clés">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-[#103b2c]/60">
                <th className="py-2 pr-4 font-medium" />
                {WINDOWS.map((w) => (
                  <th key={w} className="py-2 pr-4 text-right font-medium">
                    {WINDOW_NAMES[w]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label} className="border-t border-[#103b2c]/10">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {m.label}
                    {m.hint && <span className="block text-xs font-normal text-[#103b2c]/55">{m.hint}</span>}
                  </th>
                  {[today, week, month].map((t, i) => (
                    <td key={i} className="py-2 pr-4 text-right whitespace-nowrap">
                      {m.value(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Visites par jour" note="30 derniers jours · vert foncé : téléphone · les chiffres sous les barres sont les photos">
        <ol className="flex h-44 items-end gap-[3px]" aria-label="Visites par jour">
          {s.days.map((d) => (
            <li key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day} : ${d.visits} visites, ${d.phone} sur téléphone, ${d.photos} photos, ${d.installs} installations`}>
              <div className="flex flex-col justify-end overflow-hidden rounded-t-[3px] bg-[#ffc533]" style={{ height: `${(100 * d.visits) / maxDay}%` }}>
                <div className="bg-[#00875a]" style={{ height: d.visits ? `${(100 * d.phone) / d.visits}%` : 0 }} />
              </div>
              <span className="mt-1 text-center text-[10px] text-[#103b2c]/60 tabular-nums">{d.photos || ""}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1 flex justify-between text-xs text-[#103b2c]/55 tabular-nums">
          <span>{s.days.at(0)?.day}</span>
          <span>max {n.format(maxDay)} visites/jour</span>
          <span>{s.days.at(-1)?.day}</span>
        </p>
      </Card>

      <Card title="D'où viennent les visites" note="30 derniers jours · ?ref= ou ?utm_source=, sinon le site d'origine">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-[#103b2c]/60">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 text-right font-medium">Visites</th>
                <th className="py-2 pr-4 text-right font-medium">Téléphone</th>
                <th className="py-2 pr-4 text-right font-medium">Ont scanné</th>
                <th className="py-2 text-right font-medium">Part qui scanne</th>
              </tr>
            </thead>
            <tbody>
              {s.sources.map((r) => (
                <tr key={r.source} className="border-t border-[#103b2c]/10">
                  <td className="max-w-56 truncate py-2 pr-4 font-medium">{r.source}</td>
                  <td className="py-2 pr-4 text-right">{n.format(r.visits)}</td>
                  <td className="py-2 pr-4 text-right">{n.format(r.phone)}</td>
                  <td className="py-2 pr-4 text-right">{n.format(r.scanned)}</td>
                  <td className="py-2 text-right whitespace-nowrap">{pct(r.scanned, r.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!s.sources.length && <Empty>Aucune visite sur 30 jours.</Empty>}
        </div>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        <Card title="Langues" note="30 derniers jours">
          <ul className="flex flex-col gap-2 text-sm tabular-nums">
            {s.languages.map((l) => (
              <li key={l.locale} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3">
                <span className="font-medium">{l.locale}</span>
                <span className="h-2.5 rounded-full bg-[#ffc533]" style={{ width: `${(100 * l.visits) / maxLang}%` }} />
                <span className="text-right">{n.format(l.visits)}</span>
              </li>
            ))}
          </ul>
          {!s.languages.length && <Empty>Aucune visite sur 30 jours.</Empty>}
        </Card>

        <Card title="Jeux confirmés le plus souvent" note="30 derniers jours · « bon jeu » dans l'app">
          <ol className="flex flex-col gap-1.5 text-sm tabular-nums">
            {s.topGames.map((g) => (
              <li key={g.bggId} className="flex justify-between gap-3">
                <a href={`https://boardgamegeek.com/boardgame/${g.bggId}`} target="_blank" rel="noreferrer" className="truncate hover:underline">
                  {g.name}
                </a>
                <span>{n.format(g.times)}</span>
              </li>
            ))}
          </ol>
          {!s.topGames.length && <Empty>Aucun jeu confirmé sur 30 jours.</Empty>}
        </Card>
      </div>

      <Card title="Feedback" note="Les 30 derniers messages">
        <ul className="flex flex-col divide-y divide-[#103b2c]/10">
          {s.feedback.map((f, i) => (
            <li key={i} className="flex flex-col gap-1 py-3">
              <p className="text-xs text-[#103b2c]/60 tabular-nums">
                {f.at} UTC · {f.locale}
                {f.email && <> · <span className="select-all">{f.email}</span></>}
              </p>
              <p className="text-sm whitespace-pre-wrap">{f.message}</p>
            </li>
          ))}
        </ul>
        {!s.feedback.length && <Empty>Aucun message pour l&apos;instant.</Empty>}
      </Card>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#103b2c]/15 bg-white p-5 shadow-[4px_4px_0_#103b2c14]">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {note && <p className="mb-4 text-xs text-[#103b2c]/60">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm text-[#103b2c]/55">{children}</p>;
}
