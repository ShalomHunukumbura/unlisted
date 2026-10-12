"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sessionChanged } from "@/lib/session";

/** Delete, asked twice. */
export default function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch("/api/profile", { method: "DELETE" });
    sessionChanged();
    router.replace("/");
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-muted transition-colors hover:text-ink-strong">
        Delete account
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-ink">Delete your account, For you profile, saved roles and notifications?</span>
      <button type="button" onClick={remove} disabled={busy} className="font-medium text-red-ink hover:underline disabled:opacity-60">
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:text-ink-strong">
        Keep
      </button>
    </span>
  );
}
