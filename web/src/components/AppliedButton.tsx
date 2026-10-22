"use client";

import { Check, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { onSessionChange, signedInHere } from "@/lib/session";

import { LINK, SECONDARY } from "./ui";

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
      <span className="block rounded-[10px] bg-canvas px-3 py-2.5 text-center text-sm text-ink">
        <Link href="/signin" className={LINK}>
          Sign in
        </Link>{" "}
        to keep track of where you&apos;ve applied.
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={applied}
        title={applied ? "Remove from your applications" : "Add to your applications"}
        className={`${SECONDARY} h-11 w-full ${applied ? "border-accent/40 bg-accent-soft text-accent-ink hover:border-accent/60 hover:bg-accent-soft" : ""}`}
      >
        {applied ? <Check aria-hidden size={16} weight="bold" /> : <Plus aria-hidden size={16} weight="bold" />}
        {applied ? "Applied" : "Mark as applied"}
      </button>
      {applied && (
        <Link href="/account/applications" className="text-xs text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink-strong">
          Your applications
        </Link>
      )}
    </span>
  );
}
