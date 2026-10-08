"use client";

import { useActionState, useState } from "react";

import { signInRequestAction } from "@/lib/forYouActions";

import { CHIP } from "./ui";

/**
 * Emailed sign-in link, behind a text button: "Use on another device" on a
 * device with a profile, "Sign in with email" on one without.
 */
export default function SignInForm({ label, intro }: { label: string; intro: string }) {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState(signInRequestAction, null);

  return (
    <div className="contents">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={CHIP}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
          <rect x="2" y="3.5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 4.5L8 9l5.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="basis-full rounded-lg border border-line bg-surface p-4 text-left">
          {result?.ok ? (
            <p role="status" className="text-sm text-ink-strong">{result.message}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink">{intro}</p>
              <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                  {pending ? "Sending…" : "Email me a link"}
                </button>
                {result && !result.ok && (
                  <p role="alert" className="text-sm text-yellow-ink sm:basis-full">{result.message}</p>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
