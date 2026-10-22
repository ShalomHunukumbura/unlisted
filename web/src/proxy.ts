import { NextResponse, type NextRequest } from "next/server";

/**
 * Job ids start at 1,000,000,000 since the move to Supabase (START_ID in
 * db/deploy/move-database.sh), so a lower id is a job from before the move:
 * gone for good. Answer 410 Gone rather than the page's 404, so search engines
 * drop the thousands of old job URLs they know sooner. No database involved.
 * Jobs that expire later still get the page's own 404.
 *
 * Production only: a local database from before the move still uses low ids.
 */
const FIRST_ID = 1_000_000_000;
const ON = process.env.VERCEL_ENV === "production" || process.env.GONE_OLD_JOBS === "1";

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>This job has been removed · Unlisted</title>
<style>
  :root { color-scheme: light dark; --canvas: #f7f8fa; --ink: #3b4453; --strong: #0d1421; --accent: #0b7a68; --on: #fff; }
  @media (prefers-color-scheme: dark) { :root { --canvas: #0a0e14; --ink: #bac3d0; --strong: #eef2f7; --accent: #34c3a6; --on: #04201b; } }
  body { margin: 0; background: var(--canvas); color: var(--ink); font: 16px/1.6 system-ui, sans-serif; }
  main { max-width: 34rem; margin: 0 auto; padding: 18vh 1.25rem; }
  h1 { color: var(--strong); font-size: 2rem; line-height: 1.15; letter-spacing: -0.03em; margin: 0 0 1rem; }
  a { display: inline-block; margin-top: 1.5rem; padding: .7rem 1.2rem; border-radius: 10px; background: var(--accent); color: var(--on); font-weight: 500; text-decoration: none; }
</style>
</head>
<body>
<main>
  <h1>This job has been removed.</h1>
  <p>Unlisted only keeps roles from the past 3 days, so older links stop working. The company may still be hiring for something similar.</p>
  <a href="/">See current jobs</a>
</main>
</body>
</html>`;

export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.slice("/jobs/".length);
  if (ON && /^\d{1,9}$/.test(id) && Number(id) < FIRST_ID) {
    return new NextResponse(PAGE, {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=86400" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/jobs/:id",
};
