import { NextResponse } from "next/server";

import { companyOptions } from "@/lib/queries";

// Read-only and public: the names behind the company filter, fetched only when
// someone opens it. Cached at Vercel's edge as well as in the data cache.
export async function GET() {
  return NextResponse.json(await companyOptions(), {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" },
  });
}
