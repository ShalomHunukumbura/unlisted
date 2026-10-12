import { NextResponse } from "next/server";

import {
  STATUSES,
  applicationStatus,
  markApplied,
  removeApplication,
  trackerProfile,
  updateApplication,
} from "@/lib/applications";

const signIn = () => NextResponse.json({ ok: false, message: "Sign in to track applications." }, { status: 401 });

async function read(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  return typeof body?.id === "string" ? (body as { id: string } & Record<string, unknown>) : null;
}

/** ?job=<id>: where the signed-in person's application to that role stands, or null. */
export async function GET(request: Request) {
  const profile = await trackerProfile();
  if (!profile) return signIn();
  const job = new URL(request.url).searchParams.get("job") ?? "";
  return NextResponse.json({ ok: true, status: await applicationStatus(profile.id, job) });
}

/** { id }: mark a role as applied to. */
export async function POST(request: Request) {
  const profile = await trackerProfile();
  if (!profile) return signIn();
  const body = await read(request);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await markApplied(profile.id, body.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

/** { id, status?, notes? }: where it stands now, or the notes. */
export async function PATCH(request: Request) {
  const profile = await trackerProfile();
  if (!profile) return signIn();
  const body = await read(request);
  const status = STATUSES.find((s) => s === body?.status);
  const notes = typeof body?.notes === "string" ? body.notes : undefined;
  if (!body || (body.status !== undefined && !status) || (!status && notes === undefined)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ok = await updateApplication(profile.id, body.id, { status, notes });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

/** { id }: take it off the list. */
export async function DELETE(request: Request) {
  const profile = await trackerProfile();
  if (!profile) return signIn();
  const body = await read(request);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  await removeApplication(profile.id, body.id);
  return NextResponse.json({ ok: true });
}
