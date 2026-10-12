import { NextResponse } from "next/server";

import { followsCompany } from "@/lib/alerts";
import { currentProfile } from "@/lib/profile";

/** ?company=<name>: does the signed-in person follow that company? */
export async function GET(request: Request) {
  const email = (await currentProfile())?.email;
  if (!email) return NextResponse.json({ ok: false }, { status: 401 });
  const company = new URL(request.url).searchParams.get("company") ?? "";
  return NextResponse.json({ ok: true, following: await followsCompany(email, company.slice(0, 200)) });
}
