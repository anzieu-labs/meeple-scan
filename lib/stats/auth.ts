import { createHash, timingSafeEqual } from "node:crypto";

/** The private stats page's path, after the language. */
export const STATS_PATH = "/stats";

const sha256 = (text: string) => createHash("sha256").update(text).digest();

/**
 * Whether a request may open the stats page: HTTP Basic auth whose password is `STATS_PASSWORD` (any user
 * name). Without that variable the page doesn't exist. Compared as hashes, in constant time.
 */
export function statsAccess(authorization: string | null): "ok" | "ask" | "off" {
  const password = process.env.STATS_PASSWORD;
  if (!password) return "off";
  if (!authorization?.startsWith("Basic ")) return "ask";
  let given = "";
  try {
    given = atob(authorization.slice(6)).split(":").slice(1).join(":");
  } catch {
    return "ask";
  }
  return timingSafeEqual(sha256(given), sha256(password)) ? "ok" : "ask";
}
