import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { sendAlerts } from "@/lib/alerts";
import { sendDigests } from "@/lib/digest";
import { cleanUpProfiles } from "@/lib/profile";
import { sendPushAlerts } from "@/lib/push";
import { SYNCED } from "@/lib/queries";
import { saveCurrentWeek } from "@/lib/reports";
import { siteOrigin } from "@/lib/site";

// Called by the sync workflow (every two hours) once it has finished writing.
// Whatever doesn't fit in the time goes out on the next run.
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.ALERTS_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const origin = await siteOrigin();
  // Push first: it's quick and has no daily cap; email gets the rest of the time.
  const push = await sendPushAlerts(origin, started + 20_000);
  const email = await sendAlerts(origin, 45_000 - (Date.now() - started));
  // The weekly emails whose week is up, with what's left of the minute.
  const weekly = await sendDigests(origin, started + 52_000).catch((error) => {
    console.error("weekly emails failed", error);
    return null;
  });
  await cleanUpProfiles();
  // This week's report numbers, from the sync's copy of the week's roles.
  // A failure here must not look like the alerts failed.
  await saveCurrentWeek().catch((error) => console.error("weekly report snapshot failed", error));
  // The new jobs are in: pages refresh their cached data on their next visit
  // (the workflow visits the busiest ones next, while the database is awake).
  revalidateTag(SYNCED, "max");
  return NextResponse.json({ ...email, push, weekly });
}
