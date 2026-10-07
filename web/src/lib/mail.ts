import { randomUUID } from "node:crypto";

import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { Resend } from "resend";

/**
 * Sending email, through whichever is set up:
 *
 * 1. Resend (RESEND_API_KEY + MAIL_FROM): the free tier sends 3,000 a month,
 *    100 a day, from a domain verified in Resend. Its DKIM and SPF records
 *    are what keep the emails out of spam (see README, "Email").
 * 2. Gmail's SMTP (SMTP_USER + SMTP_PASS, a Google app password): about 500 a
 *    day, no domain needed, but a personal address sending alerts in bulk is
 *    more likely to be filtered.
 *
 * Without either, local development prints emails instead of sending them;
 * a deployment refuses, so a missing setting shows up as an error, not as
 * emails that silently never arrive.
 */
const resendKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM; // e.g. "Unlisted <alerts@mail.example.com>"
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const provider = resendKey && from ? "resend" : smtpUser && smtpPass ? "gmail" : null;
export const MAIL_CONFIGURED = provider !== null;

/**
 * Emails a day, all kinds together, kept under the provider's limit so the
 * account is never blocked. MAIL_DAILY_LIMIT overrides it (a paid plan).
 */
export const DAILY_EMAILS =
  Number(process.env.MAIL_DAILY_LIMIT) || (provider === "resend" ? 95 : 450);

const resend = provider === "resend" ? new Resend(resendKey) : null;
const smtp =
  provider === "gmail"
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
      })
    : null;

export type Mail = {
  to: string;
  subject: string;
  /** A template from src/emails; the plain-text part is made from it. */
  email: ReactElement;
  headers?: Record<string, string>;
};

/** HTML and plain text from a template. Both go out: text-only mail apps, and spam filters, look for it. */
export async function renderEmail(email: ReactElement) {
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  return { html, text };
}

export async function sendMail(mail: Mail): Promise<void> {
  const { html, text } = await renderEmail(mail.email);
  const headers = {
    // A unique id stops Gmail from folding separate alerts into one thread.
    "X-Entity-Ref-ID": randomUUID(),
    ...mail.headers,
  };
  const replyTo = process.env.MAIL_REPLY_TO || undefined;

  if (resend) {
    const { error } = await resend.emails.send({
      from: from!,
      to: mail.to,
      subject: mail.subject,
      html,
      text,
      headers,
      replyTo,
    });
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    return;
  }
  if (smtp) {
    await smtp.sendMail({
      from: { name: "Unlisted", address: smtpUser! },
      to: mail.to,
      subject: mail.subject,
      html,
      text,
      headers,
      replyTo,
    });
    return;
  }
  if (process.env.VERCEL) throw new Error("No email provider: set RESEND_API_KEY + MAIL_FROM, or SMTP_USER + SMTP_PASS");
  console.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${text}`);
}
