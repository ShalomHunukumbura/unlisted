"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { SECONDARY } from "./ui";

function Label({ label, loading }: { label: string; loading: boolean }) {
  const { pending } = useLinkStatus();
  return <>{pending || loading ? "Loading…" : label}</>;
}

/**
 * "Show more": grows the list in place, and says it's loading while it does.
 * With `auto`, it also does so by itself when it comes within a screen of
 * view, so the list just carries on. The link stays for anyone who'd rather
 * press it (or has no JavaScript).
 */
export default function MoreLink({ href, label, auto = false }: { href: string; label: string; auto?: boolean }) {
  const router = useRouter();
  const link = useRef<HTMLAnchorElement>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    const el = link.current;
    if (!auto || !el) return;
    // Replace, not push: Back from a job should land on the grown list, not step through every page of it.
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && startLoading(() => router.replace(href, { scroll: false })),
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, href, router]);

  return (
    <Link ref={link} href={href} scroll={false} replace={auto} className={SECONDARY}>
      <Label label={label} loading={loading} />
    </Link>
  );
}
