"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { followCompanyAction } from "@/lib/alertActions";
import { onSessionChange, signedInHere } from "@/lib/session";

import { CHIP, CHIP_ON } from "./ui";

/**
 * "Follow" on a company's page: an email when it posts a new role. The page
 * is the same for everyone, so someone signed in is asked about after it
 * loads; anyone else is told what signing in gets them when they press it.
 */
export default function FollowCompany({ name }: { name: string }) {
  const signedIn = useSyncExternalStore(onSessionChange, signedInHere, () => false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [askSignIn, setAskSignIn] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let stale = false;
    fetch(`/api/alerts/following?company=${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => !stale && body && setFollowing(body.following))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [signedIn, name]);

  async function toggle() {
    if (!signedIn) return setAskSignIn(true);
    setBusy(true);
    const result = await followCompanyAction(name, !following).catch(() => null);
    setBusy(false);
    if (result?.signedOut) return setAskSignIn(true);
    if (result?.ok) setFollowing(!following);
    setMessage(result?.message ?? "Something went wrong. Please try again.");
  }

  if (askSignIn) {
    return (
      <p className="text-sm text-ink">
        <Link href="/signin" className="font-medium text-ink-strong underline decoration-line underline-offset-4 hover:decoration-current">
          Sign in
        </Link>{" "}
        to follow {name} and get an email when it posts a new role.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={following} className={following ? CHIP_ON : CHIP}>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
          {following ? (
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
        {following ? "Following" : `Follow ${name}`}
      </button>
      <span role="status" className="text-xs text-muted">
        {message ?? (following ? "You get an email when it posts a new role." : "Get an email when it posts a new role.")}
      </span>
    </div>
  );
}
