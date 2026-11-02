import type { EventName, EventProps } from "./names";

/** This page load: random, kept in memory only (no cookie, nothing stored on the device). */
const visit = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;

/**
 * Counts a usage event in our own database (`/api/events`). Fire and forget: `sendBeacon` survives the page
 * being closed. Automated browsers (tests, most bots) are not counted.
 */
export function track(name: EventName, props: EventProps = {}) {
  if (!visit || typeof navigator === "undefined" || navigator.webdriver) return;
  const body = JSON.stringify({ name, props, visit, locale: document.documentElement.lang });
  if (navigator.sendBeacon?.("/api/events", body)) return;
  void fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
}
