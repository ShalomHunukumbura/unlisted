"use client";

import { useEffect } from "react";

export const FROM_KEY = "unlisted:from";

/**
 * On a page that lists jobs: when one is opened, remember which list it was
 * opened from (this tab only), so the job page can offer "Back to results"
 * and return to the same filters and scroll position.
 */
export default function ListMemory() {
  useEffect(() => {
    const remember = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="/jobs/"]');
      if (!link) return;
      try {
        sessionStorage.setItem(
          FROM_KEY,
          JSON.stringify({ job: link.getAttribute("href"), list: location.pathname + location.search }),
        );
      } catch {
        // Storage blocked (private mode): the job page just says "All jobs".
      }
    };
    document.addEventListener("click", remember);
    return () => document.removeEventListener("click", remember);
  }, []);
  return null;
}
