/**
 * The usage events the app counts, and what each one carries: nothing that identifies a person or a device.
 * `visit` ties a page load's events together (random, in memory only), so we can tell which visits scanned.
 *
 * - `visit`: a page load. `path` it opened on, `ref` from `?ref=` or `?utm_source=` (the landing's QR code is
 *   `ref=qr`), `referrer` the other site's host, `device` phone or computer, `installed` opened from the home
 *   screen.
 * - `photo`: a photo sent to be read, from the `camera` or the `gallery`.
 * - `install`: the app added to the home screen (where the browser says so).
 */
export const EVENTS = {
  visit: { path: "string", ref: "string", referrer: "string", device: ["phone", "computer"], installed: "boolean" },
  photo: { source: ["camera", "gallery"] },
  install: {},
} as const satisfies Record<string, Record<string, "string" | "boolean" | readonly string[]>>;

export type EventName = keyof typeof EVENTS;
export type EventProps = Record<string, string | boolean>;

/** Longest string kept in an event (a path, a ref, a host). */
const MAX_STRING = 100;

/** The event's props, keeping only the ones it declares with the right type; null for an unknown event. */
export function cleanEvent(name: unknown, props: unknown): { name: EventName; props: EventProps } | null {
  if (typeof name !== "string" || !Object.hasOwn(EVENTS, name)) return null;
  const spec: Record<string, "string" | "boolean" | readonly string[]> = EVENTS[name as EventName];
  const given = props && typeof props === "object" ? (props as Record<string, unknown>) : {};
  const clean: EventProps = {};
  for (const [key, type] of Object.entries(spec)) {
    const value = given[key];
    if (type === "boolean" && typeof value === "boolean") clean[key] = value;
    else if (type === "string" && typeof value === "string" && value) clean[key] = value.slice(0, MAX_STRING);
    else if (Array.isArray(type) && typeof value === "string" && type.includes(value)) clean[key] = value;
  }
  return { name: name as EventName, props: clean };
}
