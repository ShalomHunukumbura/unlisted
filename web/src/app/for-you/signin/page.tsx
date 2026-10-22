import type { Metadata } from "next";
import Link from "next/link";

import { PRIMARY, SECONDARY } from "@/components/ui";

import { redeemSignInAction } from "@/lib/forYouActions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Where an emailed sign-in link lands. The link only works when this button
 * is pressed: mail scanners open links, and must not use one up.
 */
export default async function SignIn(props: PageProps<"/for-you/signin">) {
  const sp = await props.searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-lg px-4 pb-24 pt-14 sm:pt-24">
      <section className="rise rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-9">
        {token && !sp.expired ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink-strong sm:text-3xl">
              Sign in to Unlisted
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
              One press and you&apos;re in: your &ldquo;For you&rdquo; feed and saved roles are here on this
              device too.
            </p>
            <form action={redeemSignInAction.bind(null, token)} className="mt-6">
              <button
                type="submit"
                className={`${PRIMARY} h-11 w-full`}
              >
                Sign in
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink-strong sm:text-3xl">
              That link has expired
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
              Sign-in links work once, for 30 minutes. Ask for a new one.
            </p>
            <Link
              href="/signin"
              className={`${SECONDARY} mt-6`}
            >
              Send a new link
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
