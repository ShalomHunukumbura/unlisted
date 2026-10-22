"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Application, Status } from "@/lib/applications";

import { FIELD } from "./ui";

async function send(method: "PATCH" | "DELETE", body: Record<string, unknown>) {
  const res = await fetch("/api/applications", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return res?.ok ?? false;
}

/** One application: the role, where it stands (a menu), notes, and Remove. */
export default function ApplicationRow({
  application: a,
  statuses,
  applied,
}: {
  application: Application;
  statuses: [Status, string][];
  /** "Applied 12 Oct" */
  applied: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(a.status);
  const [notes, setNotes] = useState(a.notes);
  const [savedNotes, setSavedNotes] = useState(a.notes);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  async function changeStatus(next: Status) {
    const before = status;
    setStatus(next);
    const ok = await send("PATCH", { id: a.job_id, status: next });
    setFailed(!ok);
    if (ok) router.refresh(); // the counts above the list
    else setStatus(before);
  }

  async function saveNotes() {
    if (notes === savedNotes) return;
    const ok = await send("PATCH", { id: a.job_id, notes });
    setFailed(!ok);
    if (ok) setSavedNotes(notes);
  }

  async function remove() {
    if (await send("DELETE", { id: a.job_id })) router.refresh();
    else setFailed(true);
  }

  return (
    <li className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <a
            href={a.listed ? `/jobs/${a.job_id}` : a.apply_url}
            {...(!a.listed && { target: "_blank", rel: "noopener noreferrer" })}
            className="text-[15px] font-semibold leading-snug text-ink-strong underline-offset-4 hover:text-accent-ink hover:underline"
          >
            {a.title}
          </a>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-ink">{a.company}</span>
            {a.location && <>, {a.location}</>}. {applied[0].toUpperCase() + applied.slice(1)}
            {!a.listed && <span className="block text-xs">No longer listed here; opens the employer&apos;s page</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label>
            <span className="sr-only">Where it stands</span>
            <select
              value={status}
              onChange={(e) => changeStatus(e.target.value as Status)}
              className={`${FIELD} h-10 w-auto cursor-pointer font-medium`}
            >
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-hover hover:text-ink-strong"
          >
            {savedNotes ? "Notes" : "Add notes"}
          </button>
          <button type="button" onClick={remove} className="rounded-[10px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-red-bg hover:text-red-ink">
            Remove
          </button>
        </div>
      </div>
      {!open && savedNotes && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-ink">{savedNotes}</p>}
      {open && (
        <label className="mt-3 block max-w-2xl">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-strong">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder="Who you spoke to, interview dates, what to follow up on…"
            className={FIELD}
          />
          <span className="mt-1 block text-xs text-muted">{notes === savedNotes ? "Saved" : "Saves when you click away"}</span>
        </label>
      )}
      {failed && <p role="alert" className="mt-2 text-sm text-red-ink">Couldn&apos;t save that. Please try again.</p>}
    </li>
  );
}
