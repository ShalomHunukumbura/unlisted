import type { Metadata } from "next";
import Link from "next/link";

import { ROLE_LANDINGS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Jobs by role",
  description: "Software, data, design, product and sales roles from company career pages, posted in the past week.",
  alternates: { canonical: "/roles" },
};

export default function Roles() {
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-serif text-4xl tracking-[-0.02em] text-ink-strong sm:text-5xl">Jobs by role</h1>
      <ul className="mt-8 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3">
        {ROLE_LANDINGS.map((l) => (
          <li key={l.path}>
            <Link href={l.path} className="text-ink underline decoration-line underline-offset-4 hover:text-ink-strong">
              {l.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
