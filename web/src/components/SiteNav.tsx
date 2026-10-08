"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/remote", label: "Remote" },
  { href: "/companies", label: "Companies" },
];

/**
 * The site header: the name, a couple of ways to browse, and For you as the
 * one button, so a first-time visitor sees there's a personal feed.
 */
export default function SiteNav() {
  const path = usePathname();
  const forYou = path.startsWith("/for-you");
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-5">
      <Link
        href="/"
        aria-current={path === "/" ? "page" : undefined}
        className="font-serif text-2xl leading-none tracking-[-0.01em] text-ink-strong"
      >
        Unlisted
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 text-sm">
        {LINKS.map((l) => {
          const active = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`hidden rounded-full px-3 py-1.5 transition-colors sm:block ${
                active ? "text-ink-strong" : "text-muted hover:text-ink-strong"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <Link
          href="/for-you"
          aria-current={forYou ? "page" : undefined}
          className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-[opacity,background-color,transform] duration-200 active:scale-[0.97] ${
            forYou ? "bg-hover text-ink-strong" : "bg-ink-strong text-canvas hover:opacity-85"
          }`}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <path
              d="M8 1.75l1.6 3.9 4.15.35-3.15 2.75.95 4.1L8 10.7l-3.55 2.15.95-4.1L2.25 6l4.15-.35z"
              fill="currentColor"
            />
          </svg>
          For you
        </Link>
      </nav>
    </header>
  );
}
