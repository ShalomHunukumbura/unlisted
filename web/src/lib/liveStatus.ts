/**
 * Is a posting still on the employer's board right now? Asked of the ATS
 * directly when someone opens a job page, so a role closed since the last sync
 * doesn't send them to a dead link.
 *
 * Only a clear answer counts: 200 means open, 404 means gone. Anything else
 * (timeouts, 5xx, rate limits) is "unknown", never a guess.
 */
export type LiveState = "open" | "removed" | "unknown";

type Ref = {
  ats: string;
  board_token: string;
  external_id: string;
  ats_config: Record<string, unknown> | null;
};

const HEADERS = {
  "User-Agent": "unlisted/0.1 (job search; +mailto:benjaminshalom1999@gmail.com)",
  Accept: "application/json",
};
const TIMEOUT_MS = 5000;
const e = encodeURIComponent;

async function status(url: string): Promise<LiveState> {
  try {
    const r = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.ok) return "open";
    return r.status === 404 ? "removed" : "unknown";
  } catch {
    return "unknown";
  }
}

export async function checkLive(ref: Ref): Promise<LiveState> {
  switch (ref.ats) {
    case "greenhouse":
      return status(`https://boards-api.greenhouse.io/v1/boards/${e(ref.board_token)}/jobs/${e(ref.external_id)}`);
    case "lever": {
      const host = ref.ats_config?.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
      return status(`https://${host}/v0/postings/${e(ref.board_token)}/${e(ref.external_id)}`);
    }
    case "ashby": {
      // Ashby has no single-job endpoint (its job pages answer 200 even for
      // jobs that don't exist), so look for the id in the board's listing.
      // Cached 5 minutes per board: several views of one board share a fetch.
      try {
        const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${e(ref.board_token)}`, {
          headers: HEADERS,
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (r.status === 404) return "removed";
        if (!r.ok) return "unknown";
        const board = (await r.json()) as { jobs?: { id?: string }[] };
        return board.jobs?.some((j) => j.id === ref.external_id) ? "open" : "removed";
      } catch {
        return "unknown";
      }
    }
    default:
      return "unknown";
  }
}
