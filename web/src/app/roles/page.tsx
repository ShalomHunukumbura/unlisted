import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { H1, LEAD, PAGE } from "@/components/ui";

import { ROLE_LANDINGS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Jobs by role",
  description: "Software, data, design, product and sales roles from company career pages, posted in the past 3 days.",
  alternates: { canonical: "/roles" },
};

export default function Roles() {
  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <header className="rise">
        <h1 className={H1}>Jobs by role</h1>
        <p className={`${LEAD} mt-4`}>Roles from company career pages, posted in the past 3 days.</p>
      </header>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_LANDINGS.map((l) => (
          <li key={l.path}>
            <Link
              href={l.path}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] font-medium text-ink-strong transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
            >
              {l.title}
              <ArrowRight aria-hidden size={16} className="shrink-0 text-muted transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
