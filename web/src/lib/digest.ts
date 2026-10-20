import { randomBytes } from "node:crypto";

import { createElement } from "react";

import DigestEmail from "@/emails/DigestEmail";

import { query } from "./db";
import { DAILY_EMAILS, sendMail } from "./mail";
import { matchJobs } from "./match";
import { profileById } from "./profile";

/**
 * The weekly email: an account's best "For you" matches (from the past three
 * days, all Unlisted keeps), for people who switched it on. Sent by the run
 * after each sync to whoever's week is up, so the first one arrives within
 * two hours of switching it on and the rest a week apart.
 */
const ROLES = 10;
const PER_RUN = 25;

export async function digestState(profileId: string): Promise<boolean> {
  const [row] = await query<{ digest: boolean }>(`SELECT digest FROM profiles WHERE id = $1`, [profileId]);
  return row?.digest ?? false;
}

export async function setDigest(profileId: string, on: boolean): Promise<void> {
  await query(
    `UPDATE profiles SET digest = $2, digest_token = COALESCE(digest_token, $3) WHERE id = $1`,
    [profileId, on, randomBytes(24).toString("base64url")],
  );
}

const TOKEN = /^[\w-]{20,64}$/;

/** Whose weekly email an unsubscribe link is for, and whether it's still on. */
export async function digestByToken(token: string): Promise<{ email: string; digest: boolean } | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await query<{ email: string; digest: boolean }>(
    `SELECT email, digest FROM profiles WHERE digest_token = $1 AND email IS NOT NULL`,
    [token],
  );
  return row ?? null;
}

export async function stopDigest(token: string): Promise<void> {
  if (!TOKEN.test(token)) return;
  await query(`UPDATE profiles SET digest = false WHERE digest_token = $1`, [token]);
}

/** Roles someone applied to aren't news to them. */
async function appliedTo(profileId: string): Promise<Set<string>> {
  const rows = await query<{ id: string }>(`SELECT job_id::text AS id FROM applications WHERE profile_id = $1`, [profileId]);
  return new Set(rows.map((r) => r.id));
}

/**
 * Called after the alerts, with what's left of the run. A profile that
 * couldn't be emailed (the daily cap, the clock, an error) is tried again
 * next run; one with nothing to say waits a week.
 */
export async function sendDigests(origin: string, deadline: number) {
  const report = { due: 0, emailed: 0, quiet: 0, deferred: 0, failed: 0 };
  const [{ sentToday }] = await query<{ sentToday: number }>(
    `SELECT count(*)::int AS "sentToday" FROM alert_sends WHERE sent_at > now() - interval '1 day'`,
  );
  let room = DAILY_EMAILS - sentToday;
  const due = await query<{ id: string; email: string; token: string }>(
    `SELECT id::text, email, digest_token AS token FROM profiles
      WHERE digest AND email IS NOT NULL AND digest_token IS NOT NULL
        AND (digest_at IS NULL OR digest_at < now() - interval '6 days 23 hours')
      ORDER BY digest_at NULLS FIRST LIMIT $1`,
    [PER_RUN],
  );
  report.due = due.length;

  for (const who of due) {
    if (Date.now() > deadline || room <= 0) {
      report.deferred += 1;
      continue;
    }
    const profile = await profileById(who.id);
    const applied = await appliedTo(who.id);
    const jobs =
      profile && (profile.roles.length || profile.skills.length)
        ? (await matchJobs(profile)).jobs.filter((j) => !applied.has(j.id)).slice(0, ROLES)
        : [];
    if (jobs.length === 0) {
      report.quiet += 1;
      await query(`UPDATE profiles SET digest_at = now() WHERE id = $1`, [who.id]);
      continue;
    }
    const unsubscribe = `${origin}/alerts/unsubscribe/${who.token}`;
    try {
      await sendMail({
        to: who.email,
        subject: `Your ${jobs.length} best ${jobs.length === 1 ? "match" : "matches"} this week`,
        email: createElement(DigestEmail, { jobs, origin, unsubscribeUrl: unsubscribe }),
        headers: {
          "List-Unsubscribe": `<${origin}/api/alerts/unsubscribe/${who.token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    } catch (error) {
      console.error(`weekly email for profile ${who.id} failed`, error);
      report.failed += 1;
      continue;
    }
    room -= 1;
    report.emailed += 1;
    await query(`UPDATE profiles SET digest_at = now() WHERE id = $1`, [who.id]);
    await query(`INSERT INTO alert_sends (kind) VALUES ('digest')`);
  }
  return report;
}
