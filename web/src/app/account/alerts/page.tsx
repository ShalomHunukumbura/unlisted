import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { alertAction } from "@/lib/alertActions";
import { alertsFor, describeFilters, searchUrl } from "@/lib/alerts";
import { currentProfile } from "@/lib/profile";
import { ago } from "@/lib/time";

export const metadata: Metadata = { title: "Your alerts", robots: { index: false } };

const STATE = {
  on: { label: "On", tone: "text-green-ink" },
  paused: { label: "Paused", tone: "text-muted" },
  unconfirmed: { label: "Not switched on", tone: "text-yellow-ink" },
};
const ACTION = "text-sm text-muted transition-colors hover:text-ink-strong";

/** Every search the signed-in address follows by email: pause, switch on, delete. */
export default async function Alerts() {
  const profile = await currentProfile();
  if (!profile?.email) redirect("/signin");
  const alerts = await alertsFor(profile.email);

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <Link href="/account" className="text-sm text-muted transition-colors hover:text-ink-strong">
        ← Your account
      </Link>
      <h1 className="mt-6 font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">Your alerts</h1>
      <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink">
        Searches you follow by email. New matches go to {profile.email}, one email after each hourly update.
      </p>

      {alerts.length ? (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
              <div className="min-w-0 flex-1 basis-64">
                <Link
                  href={searchUrl("", a.filters)}
                  className="text-[15px] font-medium leading-snug text-ink-strong underline-offset-4 hover:underline"
                >
                  {describeFilters(a.filters)}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  <span className={STATE[a.state].tone}>{STATE[a.state].label}</span>
                  {a.state === "on" && <> · {a.last_sent_at ? `last email ${ago(a.last_sent_at)}` : "nothing new yet"}</>}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <form action={alertAction.bind(null, a.id, a.state === "on" ? "pause" : "on")}>
                  <button type="submit" className={a.state === "on" ? ACTION : "text-sm font-medium text-ink-strong hover:underline"}>
                    {a.state === "on" ? "Pause" : a.state === "paused" ? "Resume" : "Switch on"}
                  </button>
                </form>
                <form action={alertAction.bind(null, a.id, "delete")}>
                  <button type="submit" className={`${ACTION} hover:text-red-ink`}>
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 max-w-xl rounded-xl border border-line bg-surface p-6">
          <p className="text-sm font-medium text-ink-strong">No alerts yet</p>
          <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink">
            Search or pick a filter on the home page, then press{" "}
            <span className="font-medium text-ink-strong">Email me</span> under &ldquo;Follow this search&rdquo;.
            You&apos;re signed in, so it&apos;s on straight away, with no confirmation email.
          </p>
          <Link
            href="/#roles"
            className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm text-ink-strong transition-colors hover:bg-hover"
          >
            Find a search to follow
          </Link>
        </div>
      )}
    </main>
  );
}
