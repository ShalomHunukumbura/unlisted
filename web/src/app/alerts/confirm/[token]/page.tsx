import type { Metadata } from "next";
import Link from "next/link";

import AlertPanel, { buttonClass } from "@/components/AlertPanel";
import { confirmAction } from "@/lib/alertActions";
import { describeFilters, getSubscription, searchUrl } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm alert", robots: { index: false } };

// Confirming takes a click, not just opening the link: mail scanners open
// every link in an email, and would otherwise confirm alerts nobody wanted.
export default async function ConfirmPage(props: PageProps<"/alerts/confirm/[token]">) {
  const { token } = await props.params;
  const sub = await getSubscription(token);
  if (!sub) {
    return (
      <AlertPanel eyebrow="Email alert" title="This link has expired.">
        Unconfirmed alerts are removed after a week. Set it up again from the search page.
      </AlertPanel>
    );
  }
  const what = describeFilters(sub.filters);
  if (sub.confirmed_at && !sub.unsubscribed_at) {
    return (
      <AlertPanel eyebrow="Email alert · on" title="You're subscribed.">
        <p>
          New roles matching <strong className="text-ink-strong">{what}</strong> will be emailed to {sub.email}, within
          an hour of appearing. Every email has an unsubscribe link.
        </p>
        <Link href={searchUrl("", sub.filters)} className={buttonClass}>
          See current matches
        </Link>
      </AlertPanel>
    );
  }
  return (
    <AlertPanel eyebrow="Email alert" title="Confirm your alert">
      <p>
        Email {sub.email} when new roles match <strong className="text-ink-strong">{what}</strong>?
      </p>
      <form action={confirmAction.bind(null, token)}>
        <button type="submit" className={buttonClass}>
          Confirm alert
        </button>
      </form>
    </AlertPanel>
  );
}
