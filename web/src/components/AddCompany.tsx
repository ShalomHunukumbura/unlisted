"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddCompany() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", url: value.trim() }),
      });
      const data = await res.json();
      setMsg(data.error ? `Error: ${data.error}` : data.output || "Done");
      if (!data.error) {
        setValue("");
        router.refresh();
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a careers URL, or just a company name…"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-strong"
        />
        <button
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {busy ? "Checking…" : "Add"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        e.g. <code>jobs.ashbyhq.com/linear</code>, <code>boards.greenhouse.io/figma</code>, or <code>Retool</code>
      </p>
      {msg && (
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-hover p-3 text-xs">
          {msg}
        </pre>
      )}
    </form>
  );
}
