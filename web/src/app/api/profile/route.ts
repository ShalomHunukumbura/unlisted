import { NextResponse } from "next/server";

import { cleanProfileInput, deleteProfile, saveProfile } from "@/lib/profile";

/**
 * Save this device's "For you" profile: { roles, skills, prefs, embedding? }.
 * The first save creates it and sets the cookie that is its only key.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const input = cleanProfileInput(body);
  if (typeof input === "string") return NextResponse.json({ ok: false, message: input }, { status: 400 });
  try {
    await saveProfile(input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("saving profile failed", error);
    return NextResponse.json({ ok: false, message: "Couldn't save. Please try again." }, { status: 500 });
  }
}

/** Delete the profile and everything in it (saved roles, notifications). */
export async function DELETE() {
  await deleteProfile();
  return NextResponse.json({ ok: true });
}
