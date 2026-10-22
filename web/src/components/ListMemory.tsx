"use client";

import { useEffect } from "react";

import ListKeys from "./ListKeys";

export const FROM_KEY = "unlisted:from";
/** When the last visit started (localStorage), and this tab's copy of the one before (sessionStorage). */
const VISIT_KEY = "unlisted:visit";
const SINCE_KEY = "unlisted:since";
/** Jobs opened from a list, newest last. */
const VIEWED_KEY = "unlisted:viewed";
const MAX_VIEWED = 500;

/**
 * When the visit before this one started, or null on a first visit. Read once
 * per tab and kept for it, so "New" marks don't vanish on the next page.
 */
function previousVisit(): number | null {
  try {
    const kept = sessionStorage.getItem(SINCE_KEY);
    if (kept !== null) return kept ? Number(kept) : null;
    const last = localStorage.getItem(VISIT_KEY);
    sessionStorage.setItem(SINCE_KEY, last ?? "");
    localStorage.setItem(VISIT_KEY, String(Date.now()));
    return last ? Number(last) : null;
  } catch {
    return null; // storage blocked (private mode): no marks
  }
}

function viewed(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(VIEWED_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Marks rows (JobRow's data-job / data-seen) new since the last visit, or already opened. */
function mark(since: number | null) {
  const opened = new Set(viewed());
  document.querySelectorAll<HTMLElement>("li[data-job]").forEach((row) => {
    const seen = row.dataset.seen ? Date.parse(row.dataset.seen) : NaN;
    row.toggleAttribute("data-new", since !== null && seen > since && !opened.has(row.dataset.job!));
    row.toggleAttribute("data-viewed", opened.has(row.dataset.job!));
  });
}

/**
 * On a page that lists jobs:
 *
 * - when one is opened, remember which list it was opened from (this tab
 *   only), so the job page can offer "Back to results" and return to the same
 *   filters and scroll position, and remember that it was opened;
 * - mark roles that arrived since the last visit as new, and dim the ones
 *   already opened, again as the list grows;
 * - keyboard shortcuts (ListKeys).
 */
export default function ListMemory() {
  useEffect(() => {
    const since = previousVisit();
    mark(since);

    const remember = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="/jobs/"]');
      if (!link) return;
      const href = link.getAttribute("href")!;
      try {
        sessionStorage.setItem(FROM_KEY, JSON.stringify({ job: href, list: location.pathname + location.search }));
        const id = href.slice("/jobs/".length);
        const list = viewed().filter((v) => v !== id);
        localStorage.setItem(VIEWED_KEY, JSON.stringify([...list, id].slice(-MAX_VIEWED)));
      } catch {
        // Storage blocked (private mode): the job page just says "All jobs".
      }
    };
    document.addEventListener("click", remember);

    // More rows (endless scroll, a new search) arrive without a remount.
    const main = document.getElementById("main");
    const observer = new MutationObserver(() => mark(since));
    if (main) observer.observe(main, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", remember);
      observer.disconnect();
    };
  }, []);
  return <ListKeys />;
}
