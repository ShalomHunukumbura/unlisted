import type { Metadata } from "next";
import Link from "next/link";

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
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <section className="max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
        {token && !sp.expired ? (
          <>
            <h1 className="font-serif text-3xl leading-tight tracking-[-0.01em] text-ink-strong">
              Open your profile on this device
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
              Your &ldquo;For you&rdquo; feed, saved roles and preferences will be here too. If this device already
              has a different profile, it&apos;s replaced by this one.
            </p>
            <form action={redeemSignInAction.bind(null, token)} className="mt-6">
              <button
                type="submit"
                className="rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
              >
                Open my profile
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl leading-tight tracking-[-0.01em] text-ink-strong">
              That link has expired
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
              Sign-in links work once, for 30 minutes. Ask for a new one from the For you page.
            </p>
            <Link
              href="/for-you"
              className="mt-6 inline-block rounded-md border border-line px-4 py-2 text-sm text-ink-strong transition-colors hover:bg-hover"
            >
              Go to For you
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
