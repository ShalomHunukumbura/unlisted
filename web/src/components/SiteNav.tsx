"use client";

import { Sparkle, UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { onSessionChange, signedInHere } from "@/lib/session";

import Logo from "./Logo";

const LINKS = [
  { href: "/", label: "Jobs" },
  { href: "/remote", label: "Remote" },
  { href: "/companies", label: "Companies" },
  { href: "/blog", label: "Blog" },
];

/**
 * The site header: the name, a few ways to browse, For you as the one filled
 * button, so a first-time visitor sees there's a personal feed, and Sign in
 * (or, signed in, the way to the account). Sticky, frosted over the page.
 */
export default function SiteNav() {
  const path = usePathname();
  const forYou = path.startsWith("/for-you");
  // Read after hydration only: the pages are cached without knowing who's looking.
  const signedIn = useSyncExternalStore(onSessionChange, signedInHere, () => false);
  const account = path.startsWith("/account") || path === "/signin";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Unlisted, home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path.startsWith("/jobs/") : path === l.href || path.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`hidden rounded-[10px] px-3 py-2 font-medium transition-colors md:block ${
                  active ? "bg-hover text-ink-strong" : "text-muted hover:text-ink-strong"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-2 hidden h-5 w-px bg-line md:block" />
          {signedIn ? (
            <Link
              href="/account"
              aria-label="Your account"
              aria-current={account ? "page" : undefined}
              className={`grid size-9 place-items-center rounded-[10px] transition-colors ${
                account ? "bg-hover text-ink-strong" : "text-muted hover:bg-hover hover:text-ink-strong"
              }`}
            >
              <UserCircle aria-hidden size={22} />
            </Link>
          ) : (
            <Link
              href="/signin"
              aria-current={account ? "page" : undefined}
              className={`rounded-[10px] px-3 py-2 font-medium transition-colors ${account ? "text-ink-strong" : "text-muted hover:text-ink-strong"}`}
            >
              Sign in
            </Link>
          )}
          <Link
            href="/for-you"
            aria-current={forYou ? "page" : undefined}
            className={`ml-1 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 font-medium transition-[background-color,transform] duration-200 active:scale-[0.97] ${
              forYou ? "bg-accent-soft text-accent-ink" : "bg-accent text-accent-fg hover:bg-accent-hover"
            }`}
          >
            <Sparkle aria-hidden size={15} weight="fill" />
            For you
          </Link>
        </nav>
      </div>
    </header>
  );
}
