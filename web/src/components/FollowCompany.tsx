"use client";

import { Check, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { followCompanyAction } from "@/lib/alertActions";
import { onSessionChange, signedInHere } from "@/lib/session";

import { LINK, PRIMARY, SECONDARY } from "./ui";

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
        <Link href="/signin" className={LINK}>
          Sign in
        </Link>{" "}
        to follow {name} and get an email when it posts a new role.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={following} className={following ? `${SECONDARY} border-accent/40 bg-accent-soft text-accent-ink hover:bg-accent-soft` : PRIMARY}>
        {following ? <Check aria-hidden size={16} weight="bold" /> : <Plus aria-hidden size={16} weight="bold" />}
        {following ? "Following" : `Follow ${name}`}
      </button>
      <span role="status" className="text-[13px] text-muted">
        {message ?? (following ? "You get an email when it posts a new role." : "Get an email when it posts a new role.")}
      </span>
    </div>
  );
}
