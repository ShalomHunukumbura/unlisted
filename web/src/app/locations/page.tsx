import type { Metadata } from "next";
import Link from "next/link";

import { H1, LEAD, PAGE } from "@/components/ui";

import { MIN_ROLES, countriesWithJobs, countryLanding } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs by country",
  description: "Roles from company career pages, posted in the past 3 days, by the country they're in.",
  alternates: { canonical: "/locations" },
};

export default async function Locations() {
  const countries = (await countriesWithJobs()).filter((c) => c.n >= MIN_ROLES);
  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <header className="rise">
        <h1 className={H1}>Jobs by country</h1>
        <p className={`${LEAD} mt-4`}>Roles from company career pages, posted in the past 3 days, by the country they&apos;re in.</p>
      </header>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => {
          const l = countryLanding(c.country);
          return (
            <li key={c.country}>
              <Link
                href={l.path}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
              >
                <span className="text-[15px] font-medium text-ink-strong group-hover:text-accent-ink">{l.title.replace(/^Jobs in /, "")}</span>
                <span className="rounded-md bg-hover px-2 py-0.5 text-xs font-medium tabular-nums text-ink">{c.n.toLocaleString("en-US")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
