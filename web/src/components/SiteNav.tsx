"use client";

import { List, Sparkle, UserCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { onSessionChange, signedInHere } from "@/lib/session";

import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Jobs" },
  { href: "/remote", label: "Remote" },
  { href: "/companies", label: "Companies" },
  { href: "/blog", label: "Blog" },
];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" || path.startsWith("/jobs/") : path === href || path.startsWith(`${href}/`);

/**
 * The site header: the name, a few ways to browse, For you as the one filled
 * button, so a first-time visitor sees there's a personal feed, and Sign in
 * (or, signed in, the way to the account). Sticky, frosted over the page. On
 * phones the browse links fold into a menu.
 */
export default function SiteNav() {
  const path = usePathname();
  const forYou = path.startsWith("/for-you");
  // Read after hydration only: the pages are cached without knowing who's looking.
  const signedIn = useSyncExternalStore(onSessionChange, signedInHere, () => false);
  const account = path.startsWith("/account") || path === "/signin";
  const [menu, setMenu] = useState(false);
  const header = useRef<HTMLElement>(null);

  // A new page closes the menu. Adjusting state during render, as React
  // recommends, rather than in an effect.
  const [shownFor, setShownFor] = useState(path);
  if (path !== shownFor) {
    setShownFor(path);
    setMenu(false);
  }

  // Escape or a tap outside the header closes it too.
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const tap = (e: PointerEvent) => !header.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", tap);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", tap);
    };
  }, [menu]);

  return (
    <header ref={header} className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Unlisted, home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
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
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
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
              className={`hidden rounded-[10px] px-3 py-2 font-medium transition-colors sm:block ${account ? "text-ink-strong" : "text-muted hover:text-ink-strong"}`}
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
          <button
            type="button"
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? "Close menu" : "Menu"}
            onClick={() => setMenu((m) => !m)}
            className="ml-1 grid size-9 place-items-center rounded-[10px] text-ink-strong transition-colors hover:bg-hover md:hidden"
          >
            {menu ? <X aria-hidden size={20} /> : <List aria-hidden size={20} />}
          </button>
        </nav>
      </div>

      {menu && (
        <nav id="site-menu" aria-label="Menu" className="border-t border-line bg-canvas px-4 pb-5 pt-3 md:hidden">
          <ul className="grid gap-1">
            {LINKS.map((l) => {
              const active = isActive(path, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-[10px] px-3 py-3 text-[15px] font-medium transition-colors ${
                      active ? "bg-hover text-ink-strong" : "text-ink hover:bg-hover hover:text-ink-strong"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            {signedIn ? (
              <Link href="/account" className="rounded-[10px] px-3 py-2 text-[15px] font-medium text-ink hover:bg-hover">
                Your account
              </Link>
            ) : (
              <Link href="/signin" className="rounded-[10px] px-3 py-2 text-[15px] font-medium text-ink hover:bg-hover">
                Sign in
              </Link>
            )}
            <ThemeToggle labelled />
          </div>
        </nav>
      )}
    </header>
  );
}
