import { db } from "@/db";
import { feedback } from "@/db/schema";
import { hasLocale } from "@/lib/i18n/config";

const MAX_MESSAGE = 2000;
const MAX_EMAIL = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `POST /api/feedback` with `{ message, email?, locale }`: a message from the Settings tab, kept for us to read. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { message?: unknown; email?: unknown; locale?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const locale = typeof body?.locale === "string" ? body.locale : "";
  if (message.length < 2 || message.length > MAX_MESSAGE || !hasLocale(locale) || (email && (email.length > MAX_EMAIL || !EMAIL.test(email)))) {
    return Response.json(
      { error: `Send { message: 2 to ${MAX_MESSAGE} characters, email?: an email address, locale: one of the app's languages }` },
      { status: 400 },
    );
  }
  await db.insert(feedback).values({ message, email, locale });
  return new Response(null, { status: 204 });
}
