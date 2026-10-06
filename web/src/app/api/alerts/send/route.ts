import { NextResponse } from "next/server";

import { sendAlerts } from "@/lib/alerts";
import { siteOrigin } from "@/lib/site";

// Called by the hourly sync workflow once it has finished writing. Whatever
// doesn't fit in the time goes out on the next run.
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.ALERTS_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await sendAlerts(await siteOrigin(), 45_000);
  return NextResponse.json(report);
}
