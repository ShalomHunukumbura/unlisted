"use client";

import { useActionState, useState } from "react";

import { subscribeAction } from "@/lib/alertActions";

import InstallApp from "./InstallApp";
import PushAlert from "./PushAlert";
import { CHIP } from "./ui";

/**
 * "Follow this search": the search on screen by email (after a confirmation
 * link), as a notification on this device, or by RSS. Without a search or a
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
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-strong">
            {hasFilters ? "Follow this search" : "Follow a search"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted" title={hasFilters ? what : undefined}>
            {hasFilters ? what : "Search or pick a filter, then get new matches as they come in."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasFilters && (
            <>
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={CHIP}>
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M2.5 4.5L8 9l5.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                Email me
              </button>
              <PushAlert filters={filters} />
            </>
          )}
          <a href={rss} className={CHIP} title="Follow new roles for this search in a feed reader">
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
              <path d="M3 3a10 10 0 0110 10M3 7.5A5.5 5.5 0 018.5 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="3.75" cy="12.25" r="1.25" fill="currentColor" />
            </svg>
            RSS
          </a>
          <InstallApp />
        </div>
      </div>

      {open && hasFilters && (
        <div className="mt-4 border-t border-line pt-4">
          {result?.ok ? (
            <p role="status" className="text-sm text-ink-strong">{result.message}</p>
          ) : (
            <>
              <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="hidden" name="filters" value={JSON.stringify(filters)} />
                {/* Hidden from people; bots fill it in. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Email address</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-line bg-canvas px-4 py-2 text-sm text-ink-strong placeholder:text-muted focus:border-ink-strong focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-ink-strong px-5 py-2 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Create alert"}
                </button>
              </form>
              {result && !result.ok && <p role="alert" className="mt-2 text-sm text-yellow-ink">{result.message}</p>}
              <p className="mt-2 text-xs text-muted">
                One email after each hourly update with anything new. Confirm by email first; every email has an
                unsubscribe link.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
