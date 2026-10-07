import { NextResponse } from "next/server";

import { cleanFilters } from "@/lib/alerts";
import { addPush, hasPush, parseSubscription, PUSH_CONFIGURED, removePush } from "@/lib/push";

/**
 * The device's alert for one search: { action: "on" | "off" | "status",
 * subscription, filters }. The subscription's endpoint is the credential: only
 * the browser it belongs to knows it.
 */
export async function POST(request: Request) {
  if (!PUSH_CONFIGURED) return NextResponse.json({ ok: false, message: "Notifications aren't set up here yet." }, { status: 503 });

  let body: { action?: string; subscription?: unknown; filters?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const sub = parseSubscription(body.subscription);
  if (!sub) return NextResponse.json({ ok: false, message: "This browser's push service isn't supported." }, { status: 400 });
  const filters = cleanFilters(body.filters ?? {});

  try {
    switch (body.action) {
      case "on":
        return NextResponse.json(await addPush(sub, filters));
      case "off":
        await removePush(sub.endpoint, filters);
        return NextResponse.json({ ok: true, message: "Notifications off for this search." });
      case "status":
        return NextResponse.json({ ok: true, on: await hasPush(sub.endpoint, filters) });
    }
  } catch (error) {
    console.error("push request failed", error);
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
}
