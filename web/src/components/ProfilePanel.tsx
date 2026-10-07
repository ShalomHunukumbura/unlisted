"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import ProfileEditor, { type ProfileDraft } from "./ProfileEditor";

/** What the feed is ranked by, with Edit and Delete. */
export default function ProfilePanel({
  profile,
  prefs,
  countries,
}: {
  profile: ProfileDraft;
  /** The preferences in words, e.g. "Remote, open to Sri Lanka · 3–5 yrs". */
  prefs: string;
  countries: { country: string; n: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) return <ProfileEditor initial={profile} countries={countries} onCancel={() => setEditing(false)} />;

  async function remove() {
    await fetch("/api/profile", { method: "DELETE" });
    router.refresh();
  }

  const details = [
    profile.skills.length && `${profile.skills.length} ${profile.skills.length === 1 ? "skill" : "skills"}`,
    prefs,
    profile.hasCv && "CV",
  ].filter(Boolean);

  return (
    <section
      aria-label="Your profile"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4 text-sm"
    >
      <div className="min-w-0">
        <p className="text-pretty font-medium text-ink-strong">
          {profile.roles.length ? profile.roles.join(", ") : "Any role"}
        </p>
        <p
          className="mt-0.5 truncate text-muted"
          title={profile.skills.length ? `Skills: ${profile.skills.join(", ")}` : undefined}
        >
          {details.join(" · ") || "No skills yet"}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {confirmDelete ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-ink">Delete the profile, saved roles and its notifications?</span>
            <button type="button" onClick={remove} className="font-medium text-red-ink hover:underline">
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted hover:text-ink-strong">
              Keep
            </button>
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-muted transition-colors hover:text-ink-strong"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-line px-4 py-2 text-ink-strong transition-colors hover:bg-hover active:scale-[0.98]"
            >
              Edit profile
            </button>
          </>
        )}
      </div>
    </section>
  );
}
