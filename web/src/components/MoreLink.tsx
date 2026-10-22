"use client";

import Link, { useLinkStatus } from "next/link";

import { SECONDARY } from "./ui";

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
      className={SECONDARY}
    >
      <Label label={label} />
    </Link>
  );
}
