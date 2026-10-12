"use client";

import { useState } from "react";

import EmailLinkForm from "./EmailLinkForm";
import { CHIP } from "./ui";

/**
 * Emailed sign-in link, behind a text button: "Sign in to keep it" on a
 * device with a profile, "Sign in" on one without.
 */
export default function SignInForm({ label, intro }: { label: string; intro: string }) {
  const [open, setOpen] = useState(false);

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
          <EmailLinkForm intro={intro} />
        </div>
      )}
    </div>
  );
}
