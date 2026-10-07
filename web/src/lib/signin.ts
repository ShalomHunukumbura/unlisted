import { randomBytes } from "node:crypto";

import { createElement } from "react";

import SignInEmail from "@/emails/SignInEmail";

import { CONFIRMS_PER_HOUR, EMAIL_RE } from "./alerts";
import { query } from "./db";
import { DAILY_EMAILS, sendMail } from "./mail";
import { currentProfile, rememberProfile } from "./profile";

/**
 * Opening a profile on another device, without passwords: an emailed link.
 *
 * - On a device with a profile, the link adds the address to that profile.
 * - Once an address belongs to a profile, the link opens that profile, on
 *   whichever device it's clicked.
 *
 * Links are single use and expire after LINK_MINUTES. Opening one is a button
 * press, not the page load, so mail scanners that fetch links can't use it up.
 */
const LINK_MINUTES = 30;
const RESEND_AFTER_MIN = 2;

export type SignInResult = { ok: boolean; message: string };

export async function requestSignIn(rawEmail: string, origin: string): Promise<SignInResult> {
  const email = rawEmail.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, message: "That email address doesn't look right." };
  }
  const [limits] = await query<{ hour: number; day: number; recent: number }>(
    `SELECT (SELECT count(*) FROM alert_sends WHERE kind IN ('confirm', 'login') AND sent_at > now() - interval '1 hour')::int AS hour,
            (SELECT count(*) FROM alert_sends WHERE sent_at > now() - interval '1 day')::int AS day,
            (SELECT count(*) FROM profile_logins WHERE email = $1
                AND created_at > now() - make_interval(mins => $2))::int AS recent`,
    [email, RESEND_AFTER_MIN],
  );
  if (limits.hour >= CONFIRMS_PER_HOUR || limits.day >= DAILY_EMAILS) {
    return { ok: false, message: "Too many emails going out right now. Please try again in an hour." };
  }
  // The same answer whatever happens next: it mustn't tell anyone whether an
  // address has a profile.
  const sent = {
    ok: true,
    message: `If ${email} has a profile, or this device has one, a sign-in link is on its way. It works for ${LINK_MINUTES} minutes.`,
  };
  if (limits.recent > 0) return sent;

  const [owner] = await query<{ id: string }>(`SELECT id::text FROM profiles WHERE email = $1`, [email]);
  const target = owner?.id ?? (await currentProfile())?.id;
  if (!target) return sent;

  const token = randomBytes(24).toString("base64url");
  await query(`INSERT INTO profile_logins (token, profile_id, email) VALUES ($1, $2, $3)`, [token, target, email]);
  await query(`INSERT INTO alert_sends (kind) VALUES ('login')`);

  const url = `${origin}/for-you/signin?t=${token}`;
  await sendMail({
    to: email,
    subject: "Your Unlisted sign-in link",
    email: createElement(SignInEmail, { link: url, minutes: LINK_MINUTES }),
  });
  return sent;
}

/** Use a link: this device now has that profile. False if it's used up or expired. */
export async function redeemSignIn(token: string): Promise<boolean> {
  const [login] = await query<{ profile_id: string; email: string; profile_token: string }>(
    `UPDATE profile_logins l SET used_at = now()
       FROM profiles p
      WHERE l.token = $1 AND l.used_at IS NULL AND p.id = l.profile_id
        AND l.created_at > now() - make_interval(mins => $2)
      RETURNING l.profile_id::text, l.email, p.token AS profile_token`,
    [token, LINK_MINUTES],
  );
  if (!login) return false;
  // Clicking it proves the address; the profile takes it unless another one
  // already has (only if two links for one address were out at once).
  await query(
    `UPDATE profiles SET email = $2 WHERE id = $1 AND email IS DISTINCT FROM $2
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = $2)`,
    [login.profile_id, login.email],
  );
  await rememberProfile(login.profile_token);
  return true;
}
