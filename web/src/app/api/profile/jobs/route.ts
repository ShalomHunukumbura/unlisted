import { NextResponse } from "next/server";

import { actOnJob, currentProfile, type JobAction } from "@/lib/profile";

const ACTIONS: JobAction[] = ["hide", "unhide", "save", "unsave"];

/** { id, action: "hide" | "unhide" | "save" | "unsave" } on this device's profile. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  const action = ACTIONS.find((a) => a === body?.action);
  if (!action || typeof body?.id !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ ok: false, message: "No profile on this device." }, { status: 401 });
  const ok = await actOnJob(profile, body.id, action);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
