import { query } from "@/lib/db";
import { computeWeek } from "@/lib/reports";

/**
 * Local only: compute a week's report numbers (?week=YYYY-MM-DD, a Monday),
 * and with &save=1 store them, e.g. to see a report before a week has passed.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const week = url.searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response("?week=YYYY-MM-DD (a Monday)", { status: 400 });
  const started = Date.now();
  const stats = await computeWeek(week);
  if (url.searchParams.get("save")) {
    await query(
      `INSERT INTO weekly_reports (week, stats) VALUES ($1, $2::jsonb)
       ON CONFLICT (week) DO UPDATE SET stats = EXCLUDED.stats, updated_at = now()`,
      [week, JSON.stringify(stats)],
    );
  }
  return Response.json({ ms: Date.now() - started, stats });
}
