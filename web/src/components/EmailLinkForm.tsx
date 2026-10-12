"use client";

import { useActionState } from "react";

import { signInRequestAction } from "@/lib/forYouActions";

/** An email address and "Email me a link"; once sent, where it went. */
export default function EmailLinkForm({ intro, autoFocus }: { intro?: string; autoFocus?: boolean }) {
  const [result, action, pending] = useActionState(signInRequestAction, null);

  if (result?.ok) return <p role="status" className="text-sm text-ink-strong">{result.message}</p>;
  return (
    <>
      {intro && <p className="mb-3 text-sm text-ink">{intro}</p>}
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            name="email"
            required
            autoFocus={autoFocus}
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
          {pending ? "Sending…" : "Email me a link"}
        </button>
        {result && !result.ok && (
          <p role="alert" className="text-sm text-yellow-ink sm:basis-full">{result.message}</p>
        )}
      </form>
    </>
  );
}
