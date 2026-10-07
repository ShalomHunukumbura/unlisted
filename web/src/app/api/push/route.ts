import { NextResponse } from "next/server";

import { cleanFilters } from "@/lib/alerts";
import { currentProfile } from "@/lib/profile";
import {
  addProfilePush,
  addPush,
  hasProfilePush,
  hasPush,
  parseSubscription,
  PUSH_CONFIGURED,
  removeProfilePush,
  removePush,
} from "@/lib/push";

/**
 * The device's alert for one search: { action: "on" | "off" | "status",
 * subscription, filters }, or for this device's "For you" profile with
 * { forYou: true } instead of filters. The subscription's endpoint is the
 * credential: only the browser it belongs to knows it.
 */
export async function POST(request: Request) {
  if (!PUSH_CONFIGURED) return NextResponse.json({ ok: false, message: "Notifications aren't set up here yet." }, { status: 503 });

  let body: { action?: string; subscription?: unknown; filters?: Record<string, unknown>; forYou?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const sub = parseSubscription(body.subscription);
  if (!sub) return NextResponse.json({ ok: false, message: "This browser's push service isn't supported." }, { status: 400 });
  const filters = cleanFilters(body.filters ?? {});

  try {
    if (body.forYou) {
      const profile = await currentProfile();
      if (!profile) return NextResponse.json({ ok: false, message: "Set up your profile first." }, { status: 401 });
      switch (body.action) {
        case "on":
          return NextResponse.json(await addProfilePush(sub, profile.id));
        case "off":
          await removeProfilePush(sub.endpoint, profile.id);
          return NextResponse.json({ ok: true, message: "Notifications off for new matches." });
        case "status":
          return NextResponse.json({ ok: true, on: await hasProfilePush(sub.endpoint, profile.id) });
      }
      return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
    }

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
