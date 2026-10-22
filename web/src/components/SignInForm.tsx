"use client";

import { EnvelopeSimple } from "@phosphor-icons/react";
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
<EnvelopeSimple aria-hidden size={15} />
        {label}
      </button>
      {open && (
        <div className="basis-full rounded-2xl border border-line bg-surface p-4 text-left shadow-card sm:p-5">
          <EmailLinkForm intro={intro} />
        </div>
      )}
    </div>
  );
}
