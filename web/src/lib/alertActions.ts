"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cleanFilters, confirm, deleteAlert, follow, setAlertOn, subscribe, unsubscribe, type SubscribeResult } from "./alerts";
import { currentProfile } from "./profile";
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

/** "Follow this search" when signed in: no address to type, no confirmation email. */
export async function followAction(_prev: SubscribeResult | null, form: FormData): Promise<SubscribeResult> {
  const email = (await currentProfile())?.email;
  if (!email) return { ok: false, message: "You've been signed out. Sign in again to follow this search." };
  try {
    return await follow(email, cleanFilters(JSON.parse(String(form.get("filters") ?? "{}"))));
  } catch (error) {
    console.error("follow failed", error);
    return { ok: false, message: "Something went wrong. Reload the page and try again." };
  }
}

/** The account's alerts page: pause, switch on, delete. */
export async function alertAction(id: string, what: "on" | "pause" | "delete") {
  const email = (await currentProfile())?.email;
  if (!email) redirect("/signin");
  if (what === "delete") await deleteAlert(email, id);
  else await setAlertOn(email, id, what === "on");
  revalidatePath("/account/alerts");
}
