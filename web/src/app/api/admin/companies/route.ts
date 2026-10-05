import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { READ_ONLY } from "@/lib/mode";

const run = promisify(execFile);

// The Python CLI owns discovery and all writes to jobs/companies; the web app
// only asks it to act. Kept local-only by design (single user, no auth).
const WORKERS = path.resolve(process.cwd(), "..", "workers");
const JOBSITE = path.join(WORKERS, ".venv", "bin", "jobsite");

export async function POST(req: Request) {
  if (READ_ONLY) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { action, url, id } = await req.json();

  try {
    if (action === "add") {
      if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "missing url" }, { status: 400 });
      }
      const { stdout } = await run(JOBSITE, ["add-url", url], {
        cwd: WORKERS,
        timeout: 60_000,
      });
      const added = /added/.test(stdout);
      if (added) {
        // Sync immediately so the jobs show up right away.
        const token = url.trim().split("/").filter(Boolean).pop() ?? "";
        run(JOBSITE, ["sync", "--company", token], {
          cwd: WORKERS,
          timeout: 300_000,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, output: stdout.trim() });
    }

    if (action === "toggle") {
      await query("UPDATE companies SET enabled = NOT enabled WHERE id = $1", [id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "sync") {
      const rows = await query<{ board_token: string }>(
        "SELECT board_token FROM companies WHERE id = $1",
        [id],
      );
      if (rows[0]) {
        run(JOBSITE, ["sync", "--company", rows[0].board_token], {
          cwd: WORKERS,
          timeout: 300_000,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, queued: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    // The CLI exits non-zero when nothing matched. That is an expected answer,
    // not a server fault — report it plainly instead of dumping the raw error.
    // execFile attaches the child's stdout/stderr to the thrown error.
    const e = err as Error & { stdout?: string; stderr?: string; code?: number };
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
    if (/no ATS board found/i.test(out) || e.code === 1) {
      return NextResponse.json({
        error:
          "No Greenhouse, Ashby or Lever board found for that. " +
          "Try the exact board URL (e.g. jobs.ashbyhq.com/<name>) — some " +
          "companies use Workday or a custom careers site, which aren't supported yet.",
      }, { status: 404 });
    }
    return NextResponse.json({ error: (e.message ?? String(err)).split("\n")[0] }, { status: 500 });
  }
}
