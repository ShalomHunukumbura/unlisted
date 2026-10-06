"use server";

import { redirect } from "next/navigation";

import { cleanFilters, confirm, subscribe, unsubscribe, type SubscribeResult } from "./alerts";
import { siteOrigin } from "./site";

export async function subscribeAction(_prev: SubscribeResult | null, form: FormData): Promise<SubscribeResult> {
  // A field people never see: bots fill it in, and get the same answer as anyone.
  if (form.get("website")) return { ok: true, message: "Check your inbox for a link to confirm the alert." };
  let filters = {};
  try {
    filters = cleanFilters(JSON.parse(String(form.get("filters") ?? "{}")));
  } catch {
    return { ok: false, message: "Something went wrong. Reload the page and try again." };
  }
  try {
    return await subscribe(String(form.get("email") ?? ""), filters, await siteOrigin());
  } catch (error) {
    console.error("subscribe failed", error);
    return { ok: false, message: "Couldn't send the confirmation email. Please try again later." };
  }
}

export async function confirmAction(token: string) {
  await confirm(token);
  redirect(`/alerts/confirm/${token}`);
}

export async function unsubscribeAction(token: string) {
  await unsubscribe(token);
  redirect(`/alerts/unsubscribe/${token}`);
}
