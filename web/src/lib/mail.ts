import nodemailer from "nodemailer";

/**
 * Email through Gmail's SMTP with an app password: free, about 500 emails a
 * day, no domain needed. SMTP_USER is the Gmail address, SMTP_PASS a Google
 * app password (needs 2-step verification on), never the account password.
 *
 * Without them (local development) emails are printed instead of sent.
 */
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const MAIL_CONFIGURED = Boolean(user && pass);

const transport = MAIL_CONFIGURED
  ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } })
  : null;

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

export async function sendMail(mail: Mail): Promise<void> {
  if (!transport) {
    console.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`);
    return;
  }
  await transport.sendMail({ from: { name: "Unlisted alerts", address: user! }, ...mail });
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
