"use client";

import { BellRinging, EnvelopeSimple, Rss } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";

import { followAction, subscribeAction } from "@/lib/alertActions";
import { onSessionChange, signedInHere } from "@/lib/session";

import InstallApp from "./InstallApp";
import PushAlert from "./PushAlert";
import { CHIP, FIELD, LINK, PRIMARY } from "./ui";

/**
 * "Follow this search": the search on screen by email (after a confirmation
 * link, or straight away for someone signed in), as a notification on this
 * device, or by RSS. Without a search or a
 * filter there's nothing to follow yet, and it says so.
 */
export default function AlertSignup({
  filters,
  rss,
  what,
}: {
  filters: Record<string, string>;
  rss: string;
  /** The search in words, e.g. "“python” · Remote, open to Sri Lanka". */
  what: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(subscribeAction, null);
  const [followed, follow, following] = useActionState(followAction, null);
  // Read after hydration only: the page is the same for everyone.
  const signedIn = useSyncExternalStore(onSessionChange, signedInHere, () => false);
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
            <BellRinging size={18} />
          </span>
          <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-strong">
            {hasFilters ? "Follow this search" : "Follow a search"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted" title={hasFilters ? what : undefined}>
            {hasFilters ? what : "Search or pick a filter, then get new matches as they come in."}
          </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasFilters && (
            <>
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={CHIP}>
                <EnvelopeSimple aria-hidden size={15} />
                Email me
              </button>
              <PushAlert filters={filters} />
            </>
          )}
          <a href={rss} className={CHIP} title="Follow new roles for this search in a feed reader">
            <Rss aria-hidden size={15} />
            RSS
          </a>
          <InstallApp />
        </div>
      </div>

      {open && hasFilters && signedIn && (
        <div className="mt-4 border-t border-line pt-4">
          {followed?.ok ? (
            <p role="status" className="text-sm text-ink-strong">
              {followed.message}{" "}
              <Link href="/account/alerts" className={LINK}>
                Your alerts
              </Link>
            </p>
          ) : (
            <form action={follow} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <input type="hidden" name="filters" value={JSON.stringify(filters)} />
              <button
                type="submit"
                disabled={following}
                className={PRIMARY}
              >
                {following ? "Saving…" : "Email me new matches"}
              </button>
              <span className="text-xs text-muted">
                To the address you&apos;re signed in with, one email after each update (every two hours). Pause or delete it
                from your account.
              </span>
              {followed && !followed.ok && <p role="alert" className="basis-full text-sm text-red-ink">{followed.message}</p>}
            </form>
          )}
        </div>
      )}

      {open && hasFilters && !signedIn && (
        <div className="mt-4 border-t border-line pt-4">
          {result?.ok ? (
            <p role="status" className="text-sm text-ink-strong">{result.message}</p>
          ) : (
            <>
              <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="filters" value={JSON.stringify(filters)} />
                {/* Hidden from people; bots fill it in. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <label className="min-w-0 flex-1">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-strong">Email address</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`${FIELD} h-10`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className={PRIMARY}
                >
                  {pending ? "Sending…" : "Create alert"}
                </button>
              </form>
              {result && !result.ok && <p role="alert" className="mt-2 text-sm text-red-ink">{result.message}</p>}
              <p className="mt-2 text-xs text-muted">
                One email after each update (every two hours) with anything new. Confirm by email first; every email has an
                unsubscribe link.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
