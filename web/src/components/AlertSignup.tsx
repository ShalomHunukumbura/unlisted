"use client";

import { useActionState, useState } from "react";

import { subscribeAction } from "@/lib/alertActions";

import InstallApp from "./InstallApp";
import PushAlert from "./PushAlert";

/**
 * "Email me new matches" for the search on screen. Opens an inline form; the
 * alert starts once the emailed link is confirmed.
 */
export default function AlertSignup({ filters, rss }: { filters: Record<string, string>; rss: string }) {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(subscribeAction, null);
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs text-muted">
        <InstallApp />
        <PushAlert filters={filters} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-strong"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <rect x="2" y="3.5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M2.5 4.5L8 9l5.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          Email me new matches
        </button>
        <a
          href={rss}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-strong"
          title="Follow new roles matching these filters in a feed reader"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <path d="M3 3a10 10 0 0110 10M3 7.5A5.5 5.5 0 018.5 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="3.75" cy="12.25" r="1.25" fill="currentColor" />
          </svg>
          RSS feed
        </a>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-4">
          {!hasFilters ? (
            <p className="text-sm text-ink">
              Search or pick a filter first. An alert for every new role would be hundreds of emails a day.
            </p>
          ) : result?.ok ? (
            <p role="status" className="text-sm text-ink-strong">{result.message}</p>
          ) : (
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
                  className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink-strong placeholder:text-muted focus:border-ink-strong focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-ink-strong px-4 py-2 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-60"
              >
                {pending ? "Sending…" : "Create alert"}
              </button>
              {result && !result.ok && (
                <p role="alert" className="text-sm text-yellow-ink sm:basis-full">{result.message}</p>
              )}
            </form>
          )}
          {!result?.ok && hasFilters && (
            <p className="mt-2 text-xs text-muted">
              One email after each hourly update with anything new for this search. Confirm by email first;
              unsubscribe from any alert.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
