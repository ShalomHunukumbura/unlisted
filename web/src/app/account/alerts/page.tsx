import type { Metadata } from "next";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { CARD, H1, LEAD, PAGE, SECONDARY } from "@/components/ui";
import { redirect } from "next/navigation";

import { alertAction } from "@/lib/alertActions";
import { alertsFor, describeFilters, searchUrl } from "@/lib/alerts";
import { currentProfile } from "@/lib/profile";
import { ago } from "@/lib/time";

export const metadata: Metadata = { title: "Your alerts", robots: { index: false } };

const STATE = {
  on: { label: "On", tone: "bg-accent-soft text-accent-ink" },
  paused: { label: "Paused", tone: "bg-hover text-ink" },
  unconfirmed: { label: "Not switched on", tone: "bg-yellow-bg text-yellow-ink" },
};
const ACTION = "rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink-strong";

/** Every search the signed-in address follows by email: pause, switch on, delete. */
export default async function Alerts() {
  const profile = await currentProfile();
  if (!profile?.email) redirect("/signin");
  const alerts = await alertsFor(profile.email);

  return (
    <main id="main" className={`${PAGE} pb-24 pt-8 sm:pt-10`}>
      <Link href="/account" className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink-strong">
        <ArrowLeft aria-hidden size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Your account
      </Link>
      <h1 className={`${H1} rise mt-8`}>Your alerts</h1>
      <p className={`${LEAD} mt-4`}>
        Searches you follow by email. New matches go to {profile.email}, one email after each update (every two hours).
      </p>

      {alerts.length ? (
        <ul className={`${CARD} mt-10 divide-y divide-line overflow-hidden`}>
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-5">
              <div className="min-w-0 flex-1 basis-64">
                <Link
                  href={searchUrl("", a.filters)}
                  className="text-[15px] font-semibold leading-snug text-ink-strong underline-offset-4 hover:text-accent-ink hover:underline"
                >
                  {describeFilters(a.filters)}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  <span className={`mr-2 rounded-md px-1.5 py-0.5 text-xs font-medium ${STATE[a.state].tone}`}>{STATE[a.state].label}</span>
                  {a.state === "on" && <>{a.last_sent_at ? `last email ${ago(a.last_sent_at)}` : "nothing new yet"}</>}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <form action={alertAction.bind(null, a.id, a.state === "on" ? "pause" : "on")}>
                  <button type="submit" className={a.state === "on" ? ACTION : "rounded-[10px] bg-accent-soft px-3 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent/15"}>
                    {a.state === "on" ? "Pause" : a.state === "paused" ? "Resume" : "Switch on"}
                  </button>
                </form>
                <form action={alertAction.bind(null, a.id, "delete")}>
                  <button type="submit" className={`${ACTION} hover:bg-red-bg hover:text-red-ink`}>
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${CARD} mt-10 max-w-xl p-6 sm:p-8`}>
          <p className="text-base font-semibold text-ink-strong">No alerts yet</p>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink">
            Search or pick a filter on the home page, then press{" "}
            <span className="font-medium text-ink-strong">Email me</span> under &ldquo;Follow this search&rdquo;.
            You&apos;re signed in, so it&apos;s on straight away, with no confirmation email.
          </p>
          <Link
            href="/#roles"
            className={`${SECONDARY} mt-6`}
          >
            Find a search to follow
          </Link>
        </div>
      )}
    </main>
  );
}
