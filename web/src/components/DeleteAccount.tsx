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
      <button type="button" onClick={() => setConfirming(true)} className="rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-red-bg hover:text-red-ink">
        Delete account
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-red-ink/20 bg-red-bg px-4 py-3 text-sm">
      <span className="text-ink">Delete your account, For you profile, saved roles and notifications?</span>
      <button type="button" onClick={remove} disabled={busy} className="rounded-[8px] bg-red-ink px-3 py-1.5 font-medium text-red-bg transition-opacity hover:opacity-90 disabled:opacity-60">
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium text-ink hover:text-ink-strong">
        Keep
      </button>
    </span>
  );
}
