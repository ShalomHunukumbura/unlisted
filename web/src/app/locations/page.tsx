import type { Metadata } from "next";
import Link from "next/link";

import { MIN_ROLES, countriesWithJobs, countryLanding } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs by country",
  description: "Roles from company career pages, posted in the past week, by the country they're in.",
  alternates: { canonical: "/locations" },
};

export default async function Locations() {
  const countries = (await countriesWithJobs()).filter((c) => c.n >= MIN_ROLES);
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-serif text-4xl tracking-[-0.02em] text-ink-strong sm:text-5xl">Jobs by country</h1>
      <ul className="mt-8 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3">
        {countries.map((c) => {
          const l = countryLanding(c.country);
          return (
            <li key={c.country} className="flex justify-between gap-3">
              <Link href={l.path} className="text-ink underline decoration-line underline-offset-4 hover:text-ink-strong">
                {l.title.replace(/^Jobs in /, "")}
              </Link>
              <span className="font-mono text-xs tabular-nums text-muted">{c.n.toLocaleString("en-US")}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
