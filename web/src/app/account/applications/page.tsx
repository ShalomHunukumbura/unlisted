import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ApplicationRow from "@/components/ApplicationRow";
import { STATUSES, STATUS_LABEL, listApplications, trackerProfile } from "@/lib/applications";

export const metadata: Metadata = { title: "Your applications", robots: { index: false } };

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Every role marked as applied to, newest first, with where each stands. */
export default async function Applications() {
  const profile = await trackerProfile();
  if (!profile) redirect("/signin");
  const applications = await listApplications(profile.id);
  const counts = STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length] as const).filter(([, n]) => n);

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <Link href="/account" className="text-sm text-muted transition-colors hover:text-ink-strong">
        ← Your account
      </Link>
      <h1 className="mt-6 font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">Your applications</h1>
      <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink">
        {applications.length
          ? counts.map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(" · ")
          : "Keep track of where you've applied and how each one is going."}
      </p>

      {applications.length ? (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {applications.map((a) => (
            <ApplicationRow
              key={a.job_id}
              application={a}
              statuses={STATUSES.map((s) => [s, STATUS_LABEL[s]])}
              applied={`applied ${day.format(new Date(a.applied_at))}`}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-8 max-w-xl rounded-xl border border-line bg-surface p-6">
          <p className="text-sm font-medium text-ink-strong">Nothing here yet</p>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink">
            Open any role and press <span className="font-medium text-ink-strong">Mark as applied</span> after you
            apply. It stays here even after the role leaves Unlisted, with a status and your own notes.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm text-ink-strong transition-colors hover:bg-hover"
          >
            Browse roles
          </Link>
        </div>
      )}
    </main>
  );
}
