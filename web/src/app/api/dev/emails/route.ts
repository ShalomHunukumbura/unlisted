import { createElement } from "react";

import AlertEmail, { type AlertJob } from "@/emails/AlertEmail";
import ConfirmEmail from "@/emails/ConfirmEmail";
import SignInEmail from "@/emails/SignInEmail";
import { renderEmail } from "@/lib/mail";

const JOBS: AlertJob[] = [
  { id: "1", title: "Senior Backend Engineer, Payments", company_name: "Linear", location_raw: "Remote", remote: true, open_to: "anywhere", region: null, country: null, comp_min: "160000", comp_max: "200000", comp_currency: "USD", comp_period: "year" },
  { id: "2", title: "Data Engineer", company_name: "Canva", location_raw: "Sydney, Australia", remote: true, open_to: "region", region: "APAC", country: "AU", comp_min: null, comp_max: null, comp_currency: null, comp_period: null },
  { id: "3", title: "Software Engineer II, Platform", company_name: "Datadog", location_raw: "New York, NY", remote: true, open_to: "country", region: null, country: "US", comp_min: "140000", comp_max: "175000", comp_currency: "USD", comp_period: "year" },
];

/**
 * Local previews of every email, with sample data: /api/dev/emails?name=alert
 * (or confirm, signin), and ?format=text for the plain-text part. Not
 * available in production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const origin = url.origin;
  const what = "“python” · Remote, open to Sri Lanka";
  const emails = {
    alert: createElement(AlertEmail, {
      what,
      jobs: JOBS,
      more: false,
      origin,
      allUrl: `${origin}/?q=python&remote=apac`,
      unsubscribeUrl: `${origin}/alerts/unsubscribe/sample`,
    }),
    confirm: createElement(ConfirmEmail, { email: "you@example.com", what, link: `${origin}/alerts/confirm/sample` }),
    signin: createElement(SignInEmail, { link: `${origin}/for-you/signin?t=sample`, minutes: 30 }),
  };
  const name = url.searchParams.get("name") as keyof typeof emails;
  if (!(name in emails)) {
    return new Response(Object.keys(emails).map((n) => `/api/dev/emails?name=${n}`).join("\n"));
  }
  const { html, text } = await renderEmail(emails[name]);
  return url.searchParams.get("format") === "text"
    ? new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
    : new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
