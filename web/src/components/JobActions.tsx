"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function act(id: string, action: "hide" | "unhide" | "save" | "unsave") {
  const res = await fetch("/api/profile/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  return res.ok;
}

// 40px on phones (a comfortable tap), 32px with a mouse.
const iconButton =
  "inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-line hover:text-ink-strong sm:size-8";

/**
 * Save and "Not for me" beside a role in the "For you" feed. Both change on
 * the tap and undo themselves if the server says no. Hiding folds the row
 * into one line with an Undo until the page reloads.
 */
export default function JobActions({
  id,
  saved: initiallySaved,
  title,
  hideable = true,
}: {
  id: string;
  saved: boolean;
  title: string;
  /** Off in the Saved tab, where hiding would do nothing visible. */
  hideable?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [hidden, setHidden] = useState(false);

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    if (await act(id, next ? "save" : "unsave")) router.refresh(); // the Saved count
    else setSaved(!next);
  }

  async function toggleHidden(next: boolean) {
    setHidden(next);
    if (!(await act(id, next ? "hide" : "unhide"))) setHidden(!next);
  }

  if (hidden) {
    return (
      // data-hidden folds the row (see ROW in JobRow) under this one line.
      <div
        data-hidden
        className="absolute inset-0 z-10 flex items-center justify-between gap-3 bg-canvas text-sm"
      >
        <span className="min-w-0 truncate text-muted">Hidden: {title}</span>
        <button
          type="button"
          onClick={() => toggleHidden(false)}
          className="shrink-0 rounded-md px-2 py-1 font-medium text-ink-strong transition-colors hover:bg-hover"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-1 pt-3 sm:flex-row">
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={saved}
        aria-label={saved ? "Saved. Remove from saved" : "Save"}
        title={saved ? "Saved" : "Save"}
        className={`${iconButton} ${saved ? "text-ink-strong" : ""}`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4">
          <path
            d="M4 2.75h8v10.5l-4-2.75-4 2.75z"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {hideable && (
        <button
          type="button"
          onClick={() => toggleHidden(true)}
          aria-label="Not for me"
          title="Not for me"
          className={iconButton}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
