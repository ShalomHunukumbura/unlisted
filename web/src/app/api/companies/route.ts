import { NextResponse } from "next/server";

import { companyOptions, fresh } from "@/lib/queries";

// Read-only and public: the names behind the company filter, fetched only when
// someone opens it. Cached at Vercel's edge as well as in the data cache.
export async function GET() {
  let companies = await companyOptions();
  if (companies.length === 0) companies = await fresh.companyOptions(); // cache may predate a refill
  return NextResponse.json(companies, {
    headers: {
      // Never let the edge hold an empty list: it would outlive the refill.
      "Cache-Control": companies.length
        ? "public, s-maxage=1800, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
