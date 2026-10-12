"use client";

import { useEffect } from "react";

import { SIGNED_IN, sessionChanged, signedInHere } from "@/lib/session";

/**
 * Keeps the header's "signed in" cookie true to what the server just saw. It
 * can fall behind: a profile given its address from another device, or one
 * linked before the cookie existed.
 */
export default function AccountHint({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (signedIn !== signedInHere()) {
      document.cookie = signedIn
        ? `${SIGNED_IN}=1; path=/; max-age=${400 * 86_400}; samesite=lax`
        : `${SIGNED_IN}=; path=/; max-age=0`;
    }
    // Always: the server may have just changed the cookie itself (sign in, delete).
    sessionChanged();
  }, [signedIn]);
  return null;
}
