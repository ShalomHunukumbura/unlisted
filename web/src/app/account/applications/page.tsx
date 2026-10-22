import type { Metadata } from "next";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { CARD, H1, LEAD, PAGE, SECONDARY } from "@/components/ui";
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
    <main id="main" className={`${PAGE} pb-24 pt-8 sm:pt-10`}>
      <Link href="/account" className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink-strong">
        <ArrowLeft aria-hidden size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Your account
      </Link>
      <h1 className={`${H1} rise mt-8`}>Your applications</h1>
      <p className={`${LEAD} mt-4`}>
        {applications.length
          ? counts.map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(", ")
          : "Keep track of where you've applied and how each one is going."}
      </p>

      {applications.length ? (
        <ul className={`${CARD} mt-10 divide-y divide-line overflow-hidden`}>
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
        <div className={`${CARD} mt-10 max-w-xl p-6 sm:p-8`}>
          <p className="text-base font-semibold text-ink-strong">Nothing here yet</p>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink">
            Open any role and press <span className="font-medium text-ink-strong">Mark as applied</span> after you
            apply. It stays here even after the role leaves Unlisted, with a status and your own notes.
          </p>
          <Link
            href="/"
            className={`${SECONDARY} mt-6`}
          >
            Browse roles
          </Link>
        </div>
      )}
    </main>
  );
}
