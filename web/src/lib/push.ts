import webpush, { WebPushError } from "web-push";

import { query } from "./db";
import { ALERT_FILTER_KEYS, newMatches, type Filters } from "./queries";
import { describeFilters, searchUrl } from "./alerts";

/**
 * Web push (the Push API with VAPID keys): free, works on Android, desktop and
 * iPhones with the site added to the home screen. Keys come from
 * `npx web-push generate-vapid-keys`; the public one is also given to the
 * browser, so it's a NEXT_PUBLIC_ variable.
 */
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

export const PUSH_CONFIGURED = Boolean(publicKey && privateKey);
if (PUSH_CONFIGURED) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:benjaminshalom1999@gmail.com", publicKey!, privateKey!);
}

const SEARCHES_PER_DEVICE = 10;
// Chrome/Edge on Android and desktop, Firefox, Safari, old Edge.
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export type PushKeys = { endpoint: string; keys: { p256dh: string; auth: string } };

/** A subscription as the browser sends it, or null if it isn't one. */
export function parseSubscription(raw: unknown): PushKeys | null {
  const s = raw as PushKeys | null;
  if (!s || typeof s.endpoint !== "string" || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") {
    return null;
  }
  // Only the browsers' own push services: the server posts to this URL, so it
  // mustn't be one that points anywhere else.
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    return null;
  }
  if (s.endpoint.length > 1000 || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) {
    return null;
  }
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}

export type PushResult = { ok: boolean; message: string };

export async function addPush(sub: PushKeys, filters: Filters): Promise<PushResult> {
  if (Object.keys(filters).length === 0) {
    return { ok: false, message: "Search or pick a filter first: an alert for every new role would be hundreds a day." };
  }
  const [{ mine }] = await query<{ mine: number }>(
    `SELECT count(*)::int AS mine FROM push_subscriptions WHERE endpoint = $1 AND filters <> $2::jsonb`,
    [sub.endpoint, JSON.stringify(filters)],
  );
  if (mine >= SEARCHES_PER_DEVICE) {
    return { ok: false, message: `This device already has ${SEARCHES_PER_DEVICE} alerts. Turn one off first.` };
  }
  // Re-subscribing (new keys after the browser renewed them) keeps the checkpoint.
  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, filters) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (endpoint, filters) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, JSON.stringify(filters)],
  );
  return { ok: true, message: "Notifications on for this search." };
}

export async function removePush(endpoint: string, filters: Filters): Promise<void> {
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND filters = $2::jsonb`, [endpoint, JSON.stringify(filters)]);
}

export async function hasPush(endpoint: string, filters: Filters): Promise<boolean> {
  const rows = await query(`SELECT 1 FROM push_subscriptions WHERE endpoint = $1 AND filters = $2::jsonb`, [
    endpoint,
    JSON.stringify(filters),
  ]);
  return rows.length > 0;
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string; filters: Filters; checked_until: Date };
type Match = Awaited<ReturnType<typeof newMatches>>[number];

/** What the service worker shows. Push payloads are capped at about 4 KB. */
function notification(filters: Filters, jobs: Match[], origin: string) {
  const what = describeFilters(filters);
  const first = jobs[0];
  const count = `${jobs.length}${jobs.length === 25 ? "+" : ""}`;
  return {
    title: jobs.length === 1 ? `New role: ${what}` : `${count} new roles: ${what}`,
    body:
      jobs.length === 1
        ? `${first.title} at ${first.company_name}`
        : `${first.title} at ${first.company_name}, and ${jobs.length - 1} more`,
    // One role: straight to it. More: the search, newest first.
    url: jobs.length === 1 ? `${origin}/jobs/${first.id}` : searchUrl(origin, filters),
    // A newer notification for the same search replaces the old one.
    tag: JSON.stringify(Object.fromEntries(ALERT_FILTER_KEYS.filter((k) => filters[k]).map((k) => [k, filters[k]]))),
  };
}

/**
 * Called after every sync, next to the email alerts. A device whose push
 * service says it's gone (404/410: notifications turned off, app removed) is
 * deleted; any other failure keeps the checkpoint for the next run.
 */
export async function sendPushAlerts(origin: string, deadline: number) {
  const report = { devices: 0, pushed: 0, quiet: 0, deferred: 0, failed: 0, removed: 0 };
  if (!PUSH_CONFIGURED) return report;

  const [{ now }] = await query<{ now: Date }>(`SELECT now()`);
  const until = now.toISOString();
  const subs = await query<Row>(
    `SELECT id::text, endpoint, p256dh, auth, filters, checked_until FROM push_subscriptions ORDER BY checked_until`,
  );
  report.devices = subs.length;
  for (const sub of subs) {
    if (Date.now() > deadline) {
      report.deferred += 1;
      continue;
    }
    const jobs = await newMatches(sub.filters, new Date(sub.checked_until).toISOString(), until);
    if (jobs.length > 0) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notification(sub.filters, jobs, origin)),
          { TTL: 24 * 3600, urgency: "normal", timeout: 10_000 },
        );
        report.pushed += 1;
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
          report.removed += 1;
        } else {
          console.error(`push ${sub.id} failed`, error);
          report.failed += 1;
        }
        continue;
      }
    } else {
      report.quiet += 1;
    }
    await query(
      `UPDATE push_subscriptions SET checked_until = $2${jobs.length ? ", last_sent_at = now()" : ""} WHERE id = $1`,
      [sub.id, until],
    );
  }
  return report;
}
