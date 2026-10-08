"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { FROM_KEY } from "./ListMemory";

/** The list this job was opened from, if it was opened from one in this tab. */
function cameFrom(path: string): string | null {
  try {
    const from = JSON.parse(sessionStorage.getItem(FROM_KEY) ?? "null") as { job?: string; list?: string } | null;
    return from?.job === path && from.list ? from.list : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

/**
 * The job page's way back. Opened from a list: "Back to results", which goes
 * back in history, so the filters, search and scroll position are as they
 * were. Opened any other way (a shared link, a search engine): "All jobs".
 */
export default function BackToList() {
  const router = useRouter();
  const path = usePathname();
  // Read after hydration only: the server can't know, and says "All jobs".
  const list = useSyncExternalStore(noop, () => cameFrom(path), () => null);

  return (
    <Link
      href={list ?? "/"}
      onClick={(e) => {
        if (list && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-strong"
    >
      <span aria-hidden>←</span> {list ? "Back to results" : "All jobs"}
    </Link>
  );
}
