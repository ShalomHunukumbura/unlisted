import { NextResponse } from "next/server";

import { checkLive, type LiveState } from "@/lib/liveStatus";
import { getJobRef } from "@/lib/queries";

// Read-only and public. Cached at the edge for 2 minutes per job, so a busy
// listing asks its ATS at most about once every couple of minutes.
export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]/status">) {
  const { id } = await ctx.params;
  const ref = await getJobRef(id);
  if (!ref) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The sync already saw it disappear: no need to ask again.
  const state: LiveState = ref.closed_at ? "removed" : await checkLive(ref);
  return NextResponse.json(
    { state, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } },
  );
}
