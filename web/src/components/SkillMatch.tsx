"use client";

import { Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Tag } from "./Tags";

type Result = { skills: { have: string[]; missing: string[] } | null };

/**
 * On a job page, how this device's For you skills compare with the posting.
 * Asked for after the page loads: the page itself is the same for everyone.
 */
export default function SkillMatch({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/profile/match?job=${jobId}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Result | null) => body && setResult(body))
      .catch(() => {});
    return () => ctrl.abort();
  }, [jobId]);

  if (!result) return null;
  if (!result.skills) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-[10px] bg-accent-soft/70 px-3 py-2.5 text-[13px] text-ink">
        <Sparkle aria-hidden size={14} weight="fill" className="shrink-0 text-accent" />
        <span>
          <Link href="/for-you" className="font-semibold text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-current">
            Set up For you
          </Link>{" "}
          to see how your skills match.
        </span>
      </p>
    );
  }

  const { have, missing } = result.skills;
  const total = have.length + missing.length;
  if (total === 0) return null;
  const shownMissing = missing.slice(0, 8);
  return (
    <section aria-label="Your skills" className="mt-3 rounded-[10px] bg-accent-soft/70 px-3 py-3">
      <p className="flex items-center gap-2 text-[13px] text-ink">
        <Sparkle aria-hidden size={14} weight="fill" className="shrink-0 text-accent" />
        <span>
          You have <span className="font-semibold text-ink-strong">{have.length} of {total}</span> skills this role mentions
        </span>
      </p>
      {have.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {have.map((s) => (
            <Tag key={s} tone="green">{s}</Tag>
          ))}
        </div>
      )}
      {shownMissing.length > 0 && (
        <>
          <p className="mt-3 text-xs text-muted">It also mentions</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {shownMissing.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
            {missing.length > shownMissing.length && <Tag>+{missing.length - shownMissing.length}</Tag>}
          </div>
        </>
      )}
    </section>
  );
}
