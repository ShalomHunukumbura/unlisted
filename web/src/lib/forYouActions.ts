"use server";

import { redirect } from "next/navigation";

import { redeemSignIn, requestSignIn, type SignInResult } from "./signin";
import { siteOrigin } from "./site";

export async function signInRequestAction(_prev: SignInResult | null, form: FormData): Promise<SignInResult> {
  if (form.get("website")) return { ok: true, message: "Check your inbox." }; // bots
  try {
    return await requestSignIn(String(form.get("email") ?? ""), await siteOrigin());
  } catch (error) {
    console.error("sign-in email failed", error);
    return { ok: false, message: "Couldn't send the email. Please try again later." };
  }
}

export async function redeemSignInAction(token: string) {
  const ok = await redeemSignIn(token);
  redirect(ok ? "/for-you" : "/for-you/signin?expired=1");
}
