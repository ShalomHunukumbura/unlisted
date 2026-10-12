import { randomBytes } from "node:crypto";

import { createElement } from "react";

import SignInEmail from "@/emails/SignInEmail";

import { CONFIRMS_PER_HOUR, EMAIL_RE } from "./alerts";
import { query } from "./db";
import { DAILY_EMAILS, sendMail } from "./mail";
import { currentProfile, profileForEmail, rememberProfile } from "./profile";

/**
 * Signing in without a password: an emailed link.
 *
 * - An address that already has a profile: the link opens that profile, on
 *   whichever device it's clicked.
 * - A device with a profile and a new address: the link gives that profile
 *   the address, which makes it an account.
 * - Neither: opening the link makes a new, empty profile for the address.
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
  // The same answer whether or not the address has a profile.
  const sent = {
    ok: true,
    message: `A sign-in link is on its way to ${email}. It works for ${LINK_MINUTES} minutes.`,
  };
  if (limits.recent > 0) {
    return {
      ok: true,
      message: `We sent a link to ${email} a moment ago. Check your inbox and spam folder; you can ask for another in ${RESEND_AFTER_MIN} minutes.`,
    };
  }

  const [owner] = await query<{ id: string }>(`SELECT id::text FROM profiles WHERE email = $1`, [email]);
  // Null: nobody's yet. redeemSignIn decides once the link is opened.
  const target = owner?.id ?? (await currentProfile())?.id ?? null;

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

/** Use a link: this device is now signed in to that address's profile. False if it's used up or expired. */
export async function redeemSignIn(token: string): Promise<boolean> {
  const [login] = await query<{ profile_id: string | null; email: string }>(
    `UPDATE profile_logins SET used_at = now()
      WHERE token = $1 AND used_at IS NULL AND created_at > now() - make_interval(mins => $2)
      RETURNING profile_id::text, email`,
    [token, LINK_MINUTES],
  );
  if (!login) return false;
  // Clicking it proves the address. The profile the link was for takes it; a
  // link for nobody's profile gives it to this device's, if that has no
  // address, so what was set up before signing in is kept. Not if another
  // profile has taken the address since.
  const here = login.profile_id ? null : await currentProfile();
  const taker = login.profile_id ?? (here && !here.email ? here.id : null);
  if (taker) {
    await query(
      `UPDATE profiles SET email = $2 WHERE id = $1 AND email IS DISTINCT FROM $2
          AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = $2)`,
      [taker, login.email],
    );
  }
  // Whichever profile has the address now; a new, empty one if none does.
  await rememberProfile(await profileForEmail(login.email), true);
  return true;
}
