import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EnvelopeSimpleOpen } from "@phosphor-icons/react/ssr";

import EmailLinkForm from "@/components/EmailLinkForm";
import { currentProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Sign in or sign up, the same way: an email address, then a link. */
export default async function SignIn() {
  const profile = await currentProfile();
  if (profile?.email) redirect("/account");

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-lg px-4 pb-24 pt-14 sm:pt-24">
      <section className="rise rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-9">
        <span aria-hidden className="grid size-11 place-items-center rounded-[12px] bg-accent-soft text-accent-ink">
          <EnvelopeSimpleOpen size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink-strong sm:text-3xl">Sign in to Unlisted</h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
          Enter your email address and we&apos;ll send a link that signs you in. No password, and the same link
          creates your account the first time.
        </p>
        <div className="mt-6">
          <EmailLinkForm autoFocus />
        </div>
        <p className="mt-6 border-t border-line pt-5 text-pretty text-[13px] leading-relaxed text-muted">
          {profile
            ? "Your For you feed and saved roles on this device become your account, so they're on every device you sign in on."
            : "An account keeps your For you feed and saved roles on every device. Searching and browsing never need one."}
        </p>
      </section>
    </main>
  );
}
