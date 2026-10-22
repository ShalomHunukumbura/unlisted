"use client";

import { Keyboard, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const KEYS: [string, string][] = [
  ["/", "Search"],
  ["j", "Next role"],
  ["k", "Previous role"],
  ["Enter", "Open role"],
  ["s", "Save role (For you)"],
  ["?", "Show or hide this"],
];

const KBD = "inline-grid min-w-6 place-items-center rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-strong shadow-[0_1px_0_var(--line)]";

/** The rows' links: JobRow and the For you Saved tab, not the hero's "Just posted". */
const rows = () => Array.from(document.querySelectorAll<HTMLAnchorElement>("#main li[data-job] > a"));

function typing(el: Element | null) {
  return !!el && (el.matches("input, textarea, select, [contenteditable]") || !!el.closest("[contenteditable]"));
}

/**
 * Keyboard shortcuts on a page that lists jobs, for going through dozens a
 * day: / to search, j and k to move through the roles, Enter to open, s to
 * save, ? for the list of them. Nothing fires while typing in a field.
 */
export default function ListKeys() {
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement)) return;
      if (e.key === "Escape" && help) return setHelp(false);
      if (e.key === "?") return setHelp((h) => !h);
      if (e.key === "/") {
        const search = document.getElementById("search");
        if (!search) return;
        e.preventDefault();
        search.focus();
        return;
      }
      if (e.key === "j" || e.key === "k") {
        const links = rows();
        if (!links.length) return;
        e.preventDefault();
        const at = links.indexOf(document.activeElement as HTMLAnchorElement);
        const next = at === -1 ? (e.key === "j" ? 0 : links.length - 1) : at + (e.key === "j" ? 1 : -1);
        const link = links[Math.max(0, Math.min(links.length - 1, next))];
        link.focus({ preventScroll: true });
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        link.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
        return;
      }
      if (e.key === "s") {
        const row = (document.activeElement as Element | null)?.closest("li[data-job]");
        row?.querySelector<HTMLButtonElement>('button[aria-label^="Save"]')?.click();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [help]);

  if (!help) return null;
  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="fixed bottom-4 right-4 z-40 w-72 rounded-2xl border border-line bg-surface p-5 shadow-card sm:bottom-6 sm:right-6"
    >
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink-strong">
          <Keyboard aria-hidden size={18} />
          Keyboard shortcuts
        </p>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setHelp(false)}
          className="grid size-8 place-items-center rounded-[8px] text-muted transition-colors hover:bg-hover hover:text-ink-strong"
        >
          <X aria-hidden size={16} />
        </button>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {KEYS.map(([key, what]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="text-ink">{what}</dt>
            <dd>
              <kbd className={KBD}>{key}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The quiet pointer to them, under a list, on screens with a keyboard. */
export function ShortcutHint() {
  return (
    <p className="mt-8 hidden text-center text-xs text-muted lg:block">
      Press <kbd className={KBD}>?</kbd> for keyboard shortcuts
    </p>
  );
}
