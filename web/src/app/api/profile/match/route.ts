import { NextResponse } from "next/server";

import { findSkills, skillFor } from "@/lib/catalog";
import { currentProfile } from "@/lib/profile";
import { getJob } from "@/lib/queries";

const PRIVATE = { headers: { "Cache-Control": "private, no-store" } };

/** A skill typed in that isn't in the catalog: looked for as a whole word. */
function mentions(text: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

/**
 * GET ?job=<id>: which of this device's For you skills the posting mentions,
 * and which skills it mentions that the profile doesn't have. { skills: null }
 * without a profile (or one with no skills), so the page can offer to set one up.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("job") ?? "";
  const [profile, job] = await Promise.all([currentProfile(), getJob(id)]);
  if (!job) return NextResponse.json({ skills: null }, { status: 404, ...PRIVATE });
  if (!profile?.skills.length) return NextResponse.json({ skills: null }, PRIVATE);

  const text = `${job.title}\n${(job.description_html ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ")}`;
  const posting = findSkills(text, 40);
  const mine = profile.skills.map((s) => skillFor(s)?.name ?? s);
  const mineLower = new Set(mine.map((s) => s.toLowerCase()));

  const have = mine.filter((s) => (skillFor(s) ? posting.includes(s) : mentions(text, s)));
  const missing = posting.filter((s) => !mineLower.has(s.toLowerCase()));
  return NextResponse.json({ skills: { have, missing } }, PRIVATE);
}
