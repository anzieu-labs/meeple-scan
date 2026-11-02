import { lt } from "drizzle-orm";

import { db } from "@/db";
import { events, feedback, photoLogs } from "@/db/schema";
import { RETENTION_MONTHS } from "@/lib/retention";

/**
 * Daily Vercel Cron (vercel.json): deletes what the privacy page says we don't keep, usage events and photo
 * logs after a year, feedback after two. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = (months: number) => new Date(Date.now() - months * 30.44 * 24 * 60 * 60 * 1000);
  const [deletedEvents, deletedPhotoLogs, deletedFeedback] = await Promise.all([
    db.delete(events).where(lt(events.createdAt, before(RETENTION_MONTHS.events))).returning({ id: events.id }),
    db.delete(photoLogs).where(lt(photoLogs.createdAt, before(RETENTION_MONTHS.photoLogs))).returning({ id: photoLogs.id }),
    db.delete(feedback).where(lt(feedback.createdAt, before(RETENTION_MONTHS.feedback))).returning({ id: feedback.id }),
  ]);
  return Response.json({ events: deletedEvents.length, photoLogs: deletedPhotoLogs.length, feedback: deletedFeedback.length });
}
