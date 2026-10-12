"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { onSessionChange, signedInHere } from "@/lib/session";

/**
 * "Mark as applied" on a job page, for the application tracker. The page is
 * the same for everyone, so someone signed in is asked about after it loads;
 * anyone else is told what signing in gets them when they press it.
 */
export default function AppliedButton({ jobId }: { jobId: string }) {
  const signedIn = useSyncExternalStore(onSessionChange, signedInHere, () => false);
  const [applied, setApplied] = useState(false);
  const [askSignIn, setAskSignIn] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let stale = false;
    fetch(`/api/applications?job=${jobId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => !stale && body && setApplied(body.status !== null))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [signedIn, jobId]);

  async function toggle() {
    if (!signedIn) return setAskSignIn(true);
    const next = !applied;
    setApplied(next);
    const res = await fetch("/api/applications", {
      method: next ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: jobId }),
    }).catch(() => null);
    if (res?.status === 401) setAskSignIn(true);
    if (!res?.ok) setApplied(!next);
  }

  if (askSignIn) {
    return (
      <span className="text-sm text-ink">
        <Link href="/signin" className="font-medium text-ink-strong underline decoration-line underline-offset-4 hover:decoration-current">
          Sign in
        </Link>{" "}
        to keep track of where you&apos;ve applied.
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={applied}
        title={applied ? "Remove from your applications" : "Add to your applications"}
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-[color,border-color,transform] duration-200 active:scale-[0.98] ${
          applied ? "border-ink-strong font-medium text-ink-strong" : "border-line text-ink hover:border-muted hover:text-ink-strong"
        }`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
          {applied ? (
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
        {applied ? "Applied" : "Mark as applied"}
      </button>
      {applied && (
        <Link href="/account/applications" className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink-strong">
          Your applications
        </Link>
      )}
    </span>
  );
}
