"use client";

import Link, { useLinkStatus } from "next/link";

function Label({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>{pending ? "Loading…" : label}</>;
}

/** "Show more": grows the list in place, and says it's loading while it does. */
export default function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
    >
      <Label label={label} />
    </Link>
  );
}
