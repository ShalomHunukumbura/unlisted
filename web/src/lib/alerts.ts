import { randomBytes } from "node:crypto";

import { countryName, payLabel } from "@/components/Tags";

import { query } from "./db";
import { escapeHtml, sendMail } from "./mail";
import { ALERT_FILTER_KEYS, newMatches, type Filters } from "./queries";

// Gmail's limit is about 500 emails a day; stop short of it so the account
// is never suspended. Alerts that don't fit wait for the next run.
const DAILY_EMAILS = 450;
// Signup emails: a form anyone can submit must not become a way to spam.
const CONFIRMS_PER_HOUR = 40;
const RESEND_CONFIRM_AFTER_MIN = 10;
const SUBSCRIPTIONS_PER_EMAIL = 10;

const REMOTE: Record<string, string> = {
  apac: "Remote, open to Sri Lanka",
  anywhere: "Remote from anywhere",
  "1": "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};
const EXP: Record<string, string> = {
  "0-1": "0–1 yrs", "1-2": "1–2 yrs", "3-5": "3–5 yrs", "5+": "5+ yrs", unknown: "experience not stated",
};
const PAY: Record<string, string> = {
  listed: "pay listed", "100": "$100K+", "150": "$150K+", "200": "$200K+",
};

type Subscription = {
  id: string;
  email: string;
  filters: Filters;
  token: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  checked_until: string | null;
};

/** Keep only filters the home page understands, with values it accepts. */
export function cleanFilters(raw: Record<string, unknown>): Filters {
  const f: Filters = {};
  for (const key of ALERT_FILTER_KEYS) {
    const value = typeof raw[key] === "string" ? (raw[key] as string).trim().slice(0, 200) : "";
    if (!value) continue;
    if (key === "remote" && !(value in REMOTE)) continue;
    if (key === "exp" && !(value in EXP)) continue;
    if (key === "pay" && !(value in PAY)) continue;
    if (key === "country" && !/^[A-Z]{2}$/.test(value)) continue;
    f[key] = value;
  }
  return f;
}

/** "“python” · Remote, open to Sri Lanka · $150K+" */
export function describeFilters(f: Filters): string {
  return [
    f.q && `“${f.q}”`,
    f.remote && REMOTE[f.remote],
    f.country && countryName(f.country),
    f.company,
    f.department,
    f.exp && EXP[f.exp],
    f.pay && PAY[f.pay],
  ]
    .filter(Boolean)
    .join(" · ");
}

export function searchUrl(origin: string, f: Filters): string {
  const qs = new URLSearchParams(Object.entries(f) as [string, string][]).toString();
  return `${origin}/${qs ? `?${qs}` : ""}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SubscribeResult = { ok: boolean; message: string };

/**
 * Save an alert and email a confirmation link. Nothing is sent to a subscriber
 * until they click it, so typing someone else's address does nothing more than
 * send them one confirmation email.
 */
export async function subscribe(rawEmail: string, filters: Filters, origin: string): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, message: "That email address doesn't look right." };
  }
  if (Object.keys(filters).length === 0) {
    return { ok: false, message: "Search or pick a filter first: an alert for every new role would be hundreds a day." };
  }

  const [limits] = await query<{ hour: number; day: number; mine: number }>(
    `SELECT (SELECT count(*) FROM alert_sends WHERE kind = 'confirm' AND sent_at > now() - interval '1 hour')::int AS hour,
            (SELECT count(*) FROM alert_sends WHERE sent_at > now() - interval '1 day')::int AS day,
            (SELECT count(*) FROM alert_subscriptions WHERE email = $1 AND unsubscribed_at IS NULL)::int AS mine`,
    [email],
  );
  if (limits.hour >= CONFIRMS_PER_HOUR || limits.day >= DAILY_EMAILS) {
    return { ok: false, message: "Too many signups right now. Please try again in an hour." };
  }

  const [existing] = await query<Subscription & { last_confirm: string | null }>(
    `SELECT s.*, (SELECT max(sent_at) FROM alert_sends WHERE subscription_id = s.id AND kind = 'confirm') AS last_confirm
       FROM alert_subscriptions s WHERE email = $1 AND filters = $2::jsonb`,
    [email, JSON.stringify(filters)],
  );
  // The same answer whether or not the address already has alerts.
  const sent = { ok: true, message: `Check ${email} for a link to confirm the alert.` };

  if (existing?.confirmed_at && !existing.unsubscribed_at) return sent; // already on
  if (!existing && limits.mine >= SUBSCRIPTIONS_PER_EMAIL) {
    return { ok: false, message: `That address already has ${SUBSCRIPTIONS_PER_EMAIL} alerts. Unsubscribe from one first.` };
  }
  if (existing?.last_confirm && Date.now() - new Date(existing.last_confirm).getTime() < RESEND_CONFIRM_AFTER_MIN * 60_000) {
    return sent; // a confirmation just went out
  }

  const token = randomBytes(24).toString("base64url");
  const [sub] = await query<{ id: string }>(
    `INSERT INTO alert_subscriptions (email, filters, token) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (email, filters) DO UPDATE
        SET token = EXCLUDED.token, confirmed_at = NULL, unsubscribed_at = NULL, created_at = now()
     RETURNING id::text`,
    [email, JSON.stringify(filters), token],
  );

  const what = describeFilters(filters);
  const link = `${origin}/alerts/confirm/${token}`;
  await sendMail({
    to: email,
    subject: `Confirm your Unlisted alert: ${what}`,
    text: `Someone (hopefully you) asked Unlisted to email ${email} when new roles match:\n\n  ${what}\n\nConfirm here: ${link}\n\nIf it wasn't you, ignore this email and nothing more will be sent.\n`,
    html: `<p>Someone (hopefully you) asked Unlisted to email ${escapeHtml(email)} when new roles match:</p>
<p><strong>${escapeHtml(what)}</strong></p>
<p><a href="${escapeHtml(link)}">Confirm the alert</a></p>
<p style="color:#777">If it wasn't you, ignore this email and nothing more will be sent.</p>`,
  });
  await query(`INSERT INTO alert_sends (subscription_id, kind) VALUES ($1, 'confirm')`, [sub.id]);
  return sent;
}

export async function getSubscription(token: string): Promise<Subscription | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const rows = await query<Subscription>(
    `SELECT id::text, email, filters, token, confirmed_at, unsubscribed_at, checked_until
       FROM alert_subscriptions WHERE token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

/** Start alerting from now: roles seen before confirming aren't news. */
export async function confirm(token: string): Promise<void> {
  await query(
    `UPDATE alert_subscriptions SET confirmed_at = now(), checked_until = now(), unsubscribed_at = NULL
      WHERE token = $1 AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)`,
    [token],
  );
}

export async function unsubscribe(token: string): Promise<void> {
  await query(
    `UPDATE alert_subscriptions SET unsubscribed_at = now() WHERE token = $1 AND unsubscribed_at IS NULL`,
    [token],
  );
}

type Match = Awaited<ReturnType<typeof newMatches>>[number];

function alertEmail(sub: Subscription, jobs: Match[], origin: string) {
  const what = describeFilters(sub.filters);
  const unsubscribeUrl = `${origin}/alerts/unsubscribe/${sub.token}`;
  const all = searchUrl(origin, sub.filters);
  const lines = jobs.map((j) => {
    const details = [j.company_name, j.location_raw, payLabel(j)].filter(Boolean).join(" · ");
    return { title: j.title, details, url: `${origin}/jobs/${j.id}` };
  });
  const count = `${jobs.length}${jobs.length === 25 ? "+" : ""} new ${jobs.length === 1 ? "role" : "roles"}`;

  return {
    to: sub.email,
    subject: `${count}: ${what}`,
    text:
      `${count} for ${what}\n\n` +
      lines.map((l) => `${l.title}\n${l.details}\n${l.url}`).join("\n\n") +
      `\n\nAll matches: ${all}\n\nUnsubscribe: ${unsubscribeUrl}\n`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
<p style="color:#555">${escapeHtml(count)} for <strong>${escapeHtml(what)}</strong></p>
${lines
  .map(
    (l) => `<p style="margin:0 0 14px"><a href="${escapeHtml(l.url)}" style="font-weight:600;color:#111">${escapeHtml(l.title)}</a><br><span style="color:#555">${escapeHtml(l.details)}</span></p>`,
  )
  .join("\n")}
<p><a href="${escapeHtml(all)}">See all matches on Unlisted</a></p>
<p style="color:#888;font-size:12px">You asked for alerts for this search. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888">Unsubscribe</a></p>
</div>`,
    headers: {
      // One-click unsubscribe in Gmail and other clients (RFC 8058).
      "List-Unsubscribe": `<${origin}/api/alerts/unsubscribe/${sub.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/**
 * Called after every sync: one email per subscription with new matches. A
 * subscription that couldn't be emailed (daily cap, time budget, an SMTP
 * error) keeps its checkpoint, so its matches go out on a later run.
 */
export async function sendAlerts(origin: string, budgetMs = 45_000) {
  const started = Date.now();
  await query(`DELETE FROM alert_sends WHERE sent_at < now() - interval '2 days'`);
  await query(
    `DELETE FROM alert_subscriptions WHERE confirmed_at IS NULL AND created_at < now() - interval '7 days'`,
  );

  const [{ until, sentToday }] = await query<{ until: Date; sentToday: number }>(
    `SELECT now() AS until,
            (SELECT count(*) FROM alert_sends WHERE sent_at > now() - interval '1 day')::int AS "sentToday"`,
  );
  const untilIso = until.toISOString();
  let room = DAILY_EMAILS - sentToday;

  const subs = await query<Subscription>(
    `SELECT id::text, email, filters, token, confirmed_at, unsubscribed_at, checked_until
       FROM alert_subscriptions
      WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
      ORDER BY checked_until NULLS FIRST`,
  );

  const report = { subscriptions: subs.length, emailed: 0, quiet: 0, deferred: 0, failed: 0 };
  for (const sub of subs) {
    if (Date.now() - started > budgetMs) {
      report.deferred += 1;
      continue;
    }
    const since = sub.checked_until ?? sub.confirmed_at!;
    const jobs = await newMatches(sub.filters, new Date(since).toISOString(), untilIso);
    if (jobs.length === 0) {
      report.quiet += 1;
      await query(`UPDATE alert_subscriptions SET checked_until = $2 WHERE id = $1`, [sub.id, untilIso]);
      continue;
    }
    if (room <= 0) {
      report.deferred += 1;
      continue;
    }
    try {
      await sendMail(alertEmail(sub, jobs, origin));
    } catch (error) {
      console.error(`alert ${sub.id} failed`, error);
      report.failed += 1;
      continue;
    }
    room -= 1;
    report.emailed += 1;
    await query(
      `UPDATE alert_subscriptions SET checked_until = $2, last_sent_at = now() WHERE id = $1`,
      [sub.id, untilIso],
    );
    await query(`INSERT INTO alert_sends (subscription_id, kind) VALUES ($1, 'alert')`, [sub.id]);
  }
  return report;
}
