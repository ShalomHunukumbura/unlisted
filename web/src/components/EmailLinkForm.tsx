"use client";

import { useActionState } from "react";

import { signInRequestAction } from "@/lib/forYouActions";

import { FIELD, PRIMARY } from "./ui";

/** An email address and "Email me a link"; once sent, where it went. */
export default function EmailLinkForm({ intro, autoFocus }: { intro?: string; autoFocus?: boolean }) {
  const [result, action, pending] = useActionState(signInRequestAction, null);

  if (result?.ok) {
    return (
      <p role="status" className="rounded-[10px] border border-accent/25 bg-accent-soft px-4 py-3 text-sm text-accent-ink">
        {result.message}
      </p>
    );
  }
  return (
    <>
      {intro && <p className="mb-4 text-pretty text-sm leading-relaxed text-ink">{intro}</p>}
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-strong">Email address</span>
          <input
            type="email"
            name="email"
            required
            autoFocus={autoFocus}
            autoComplete="email"
            placeholder="you@example.com"
            className={`${FIELD} h-11`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={`${PRIMARY} h-11`}
        >
          {pending ? "Sending…" : "Email me a link"}
        </button>
        {result && !result.ok && (
          <p role="alert" className="text-sm text-red-ink sm:basis-full">{result.message}</p>
        )}
      </form>
    </>
  );
}
