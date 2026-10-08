import { NextResponse } from "next/server";

import { sendAlerts } from "@/lib/alerts";
import { cleanUpProfiles } from "@/lib/profile";
import { sendPushAlerts } from "@/lib/push";
import { saveCurrentWeek } from "@/lib/reports";
import { siteOrigin } from "@/lib/site";

// Called by the hourly sync workflow once it has finished writing. Whatever
// doesn't fit in the time goes out on the next run.
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
  await cleanUpProfiles();
  // The weekly report's numbers, while this week's jobs are all still here.
  // A failure here must not look like the alerts failed.
  await saveCurrentWeek().catch((error) => console.error("weekly report snapshot failed", error));
  return NextResponse.json({ ...email, push });
}
