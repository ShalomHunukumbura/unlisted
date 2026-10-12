import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import DeleteAccount from "@/components/DeleteAccount";
import { signOutAction } from "@/lib/forYouActions";
import { currentProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const ROW = "flex items-center justify-between gap-4 px-5 py-4 text-sm transition-colors hover:bg-hover";

/** Who's signed in, where their things are, and the way out. */
export default async function Account() {
  const profile = await currentProfile();
  if (!profile?.email) redirect("/signin");
  const setUp = profile.roles.length > 0 || profile.skills.length > 0;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">Your account</h1>
      <p className="mt-3 text-[15px] text-ink">
        Signed in as <span className="font-medium text-ink-strong">{profile.email}</span>
      </p>

      <ul className="mt-8 max-w-xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        <li>
          <Link href="/for-you" className={ROW}>
            <span>
              <span className="font-medium text-ink-strong">For you</span>
              <span className="mt-0.5 block text-muted">
                {setUp
                  ? profile.roles.length
                    ? profile.roles.join(", ")
                    : `${profile.skills.length} ${profile.skills.length === 1 ? "skill" : "skills"}`
                  : "Add the roles you want and your skills to get a ranked feed"}
              </span>
            </span>
            <span aria-hidden className="text-muted">→</span>
          </Link>
        </li>
        <li>
          <Link href="/for-you?tab=saved" className={ROW}>
            <span>
              <span className="font-medium text-ink-strong">Saved roles</span>
              <span className="mt-0.5 block text-muted">
                {profile.saved.length ? `${profile.saved.length} saved` : "Nothing saved yet"}
              </span>
            </span>
            <span aria-hidden className="text-muted">→</span>
          </Link>
        </li>
      </ul>

      <div className="mt-8 flex max-w-xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-line px-4 py-2 text-sm text-ink-strong transition-colors hover:bg-hover active:scale-[0.98]"
          >
            Sign out
          </button>
        </form>
        <DeleteAccount />
      </div>
    </main>
  );
}
