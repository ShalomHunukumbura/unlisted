import type { Metadata } from "next";

import AlertPanel, { buttonClass } from "@/components/AlertPanel";
import { unsubscribeAction } from "@/lib/alertActions";
import { describeFilters, getSubscription } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// A button, not an instant unsubscribe on opening: link scanners open every
// URL in an email. The email client's own unsubscribe button is one-click.
export default async function UnsubscribePage(props: PageProps<"/alerts/unsubscribe/[token]">) {
  const { token } = await props.params;
  const sub = await getSubscription(token);
  if (!sub) {
    return (
      <AlertPanel eyebrow="Email alert" title="Nothing to unsubscribe from.">
        This alert no longer exists, so no more emails will be sent for it.
      </AlertPanel>
    );
  }
  const what = describeFilters(sub.filters);
  if (sub.unsubscribed_at) {
    return (
      <AlertPanel eyebrow="Email alert · off" title="You're unsubscribed.">
        No more emails for <strong className="text-ink-strong">{what}</strong>. Any other alerts you set up are
        unaffected.
      </AlertPanel>
    );
  }
  return (
    <AlertPanel eyebrow="Email alert" title="Stop this alert?">
      <p>
        {sub.email} gets new roles matching <strong className="text-ink-strong">{what}</strong>.
      </p>
      <form action={unsubscribeAction.bind(null, token)}>
        <button type="submit" className={buttonClass}>
          Unsubscribe
        </button>
      </form>
    </AlertPanel>
  );
}
