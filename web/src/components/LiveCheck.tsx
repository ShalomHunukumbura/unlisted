"use client";

import { useEffect, useState } from "react";

type State = "checking" | "open" | "removed" | "unknown";

/**
 * Asks /api/jobs/[id]/status whether the posting is still on the employer's
 * board. Runs after the page loads, so the page itself never waits on an ATS.
 */
export default function LiveCheck({ jobId, ats }: { jobId: string; ats: string }) {
  const [state, setState] = useState<State>("checking");
  const [minutesOld, setMinutesOld] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/jobs/${jobId}/status`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { state: "unknown" }))
      .then((d: { state: State; checkedAt?: string }) => {
        setState(d.state);
        // The answer can come from a short edge cache: work out how old it is.
        if (d.checkedAt) setMinutesOld(Math.floor((Date.now() - new Date(d.checkedAt).getTime()) / 60_000));
      })
      .catch(() => !ctrl.signal.aborted && setState("unknown"));
    return () => ctrl.abort();
  }, [jobId]);

  const when = minutesOld < 1 ? "checked just now" : `checked ${minutesOld} min ago`;

  const view = {
    checking: { dot: "bg-muted animate-pulse", text: `Checking ${ats} for this posting…`, tone: "text-muted" },
    open: { dot: "bg-green-ink", text: `Still open on ${ats} · ${when}`, tone: "text-green-ink" },
    removed: {
      dot: "bg-red-ink",
      text: `No longer on ${ats}. The employer has probably filled or withdrawn it.`,
      tone: "text-red-ink",
    },
    unknown: { dot: "bg-yellow-ink", text: `Couldn't reach ${ats} just now. Open the posting to check.`, tone: "text-yellow-ink" },
  }[state];

  return (
    <p aria-live="polite" className={`flex items-center gap-2 text-sm ${view.tone}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${view.dot}`} />
      {view.text}
    </p>
  );
}
