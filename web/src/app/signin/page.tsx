import type { Metadata } from "next";
import { redirect } from "next/navigation";

import EmailLinkForm from "@/components/EmailLinkForm";
import { currentProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Sign in or sign up, the same way: an email address, then a link. */
export default async function SignIn() {
  const profile = await currentProfile();
  if (profile?.email) redirect("/account");

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <section className="max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-serif text-3xl leading-tight tracking-[-0.01em] text-ink-strong">Sign in to Unlisted</h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
          Enter your email address and we&apos;ll send a link that signs you in. No password, and the same link
          creates your account the first time.
        </p>
        <div className="mt-6">
          <EmailLinkForm autoFocus />
        </div>
        <p className="mt-6 text-pretty text-xs leading-relaxed text-muted">
          {profile
            ? "Your For you feed and saved roles on this device become your account, so they're on every device you sign in on."
            : "An account keeps your For you feed and saved roles on every device. Searching and browsing never need one."}
        </p>
      </section>
    </main>
  );
}
