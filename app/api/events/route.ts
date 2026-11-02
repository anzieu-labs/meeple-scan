import { db } from "@/db";
import { events } from "@/db/schema";
import { cleanEvent } from "@/lib/events/names";
import { hasLocale } from "@/lib/i18n/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An event is a few hundred bytes; anything much bigger isn't one. */
const MAX_BODY = 2048;
/** Crawlers and audit tools that run scripts: not visitors. */
const BOT = /bot|crawl|spider|slurp|lighthouse|headless/i;

/**
 * `POST /api/events` with `{ name, props, visit, locale }` (a `sendBeacon` body, so read as text): one usage
 * event, kept in our database. No IP address or user agent is stored.
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: { name?: unknown; props?: unknown; visit?: unknown; locale?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const event = cleanEvent(body?.name, body?.props);
  const visit = typeof body?.visit === "string" && UUID.test(body.visit) ? body.visit : null;
  const locale = typeof body?.locale === "string" ? body.locale : "";
  if (!event || !visit || !hasLocale(locale)) {
    return Response.json({ error: "Send { name: a known event, props, visit: a UUID, locale: one of the app's languages }" }, { status: 400 });
  }
  await db.insert(events).values({ ...event, visit, locale });
  return new Response(null, { status: 204 });
}
