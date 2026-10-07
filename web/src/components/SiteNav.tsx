"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "All roles" },
  { href: "/for-you", label: "For you" },
];

/** The two feeds: everything, and ranked for you. */
export default function SiteNav() {
  const path = usePathname();
  const current = path.startsWith("/for-you") ? "/for-you" : path === "/" ? "/" : null;
  return (
    <nav aria-label="Feeds" className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-4">
      <ul className="flex gap-1 rounded-lg border border-line bg-surface p-0.5 text-sm">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className={`block rounded-md px-3 py-1.5 transition-colors ${
                current === l.href ? "bg-hover font-medium text-ink-strong" : "text-muted hover:text-ink-strong"
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
