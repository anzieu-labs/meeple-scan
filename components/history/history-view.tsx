"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { LazyGameDrawer } from "@/components/game/lazy-game-drawer";
import { GameRow } from "@/components/game/game-row";
import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import { Button } from "@/components/ui/button";
import { clearHistory, historyStore, removeFromHistory, type HistoryEntry } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";
import { fill, plural, timeAgo } from "@/lib/i18n/format";

import { PageHeader, PageShell } from "@/components/nav/page-shell";

/** Games confirmed or picked on this phone (kept locally), newest first. Tapping one shows it again. */
export function HistoryView() {
  const { locale, t } = useI18n();
  const entries = useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <PageShell>
      <PageHeader
        title={t.history.title}
        subtitle={entries.length ? plural(locale, entries.length, t.history.count) : t.history.empty}
      />
      {entries.length > 0 && <HistoryList entries={entries} onSelect={setOpen} />}
      <div className="flex flex-col gap-4 p-4">
        {entries.length > 0 && (
          <Button variant="ghost" className="self-start text-muted-foreground" onClick={clearHistory}>
            {t.history.clear}
          </Button>
        )}
        <PoweredByBgg />
      </div>
      <LazyGameDrawer bggId={open} onClose={() => setOpen(null)} />
    </PageShell>
  );
}

/** Only drawn with entries, which exist in the browser only: "5 min ago" is computed there, never prerendered. */
function HistoryList({ entries, onSelect }: { entries: HistoryEntry[]; onSelect: (bggId: number) => void }) {
  const { locale, t } = useI18n();
  const [now] = useState(() => Date.now());
  return (
    <ul className="divide-y border-y" data-testid="history-list">
      {entries.map((entry) => (
        <li key={entry.bggId} className="flex items-center gap-1 pr-2">
          <div className="min-w-0 flex-1">
            <GameRow game={entry} detail={timeAgo(locale, entry.scannedAt, now)} onSelect={() => onSelect(entry.bggId)} />
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={fill(t.history.remove, { name: entry.name })}
            onClick={() => removeFromHistory(entry.bggId)}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
