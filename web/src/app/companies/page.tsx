import type { Metadata } from "next";
import Link from "next/link";

import CompanyMark from "@/components/CompanyMark";
import { H1, LEAD, PAGE } from "@/components/ui";

import { companiesWithJobs } from "@/lib/seo";

export const dynamic = "force-dynamic";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
const letterOf = (name: string) => (/^[a-z]/i.test(name) ? name[0].toUpperCase() : "#");
const param = (letter: string) => (letter === "#" ? "0-9" : letter.toLowerCase());

function pick(raw: string | string[] | undefined) {
  const v = typeof raw === "string" ? raw.toUpperCase() : "";
  return v === "0-9" ? "#" : LETTERS.includes(v) ? v : null;
}

export async function generateMetadata(props: PageProps<"/companies">): Promise<Metadata> {
  const letter = pick((await props.searchParams).letter);
  return letter
    ? {
        title: `Companies hiring: ${letter === "#" ? "0 to 9" : letter}`,
        description: `Companies starting with ${letter === "#" ? "a number" : letter} with a role posted on their careers page in the past 3 days.`,
        alternates: { canonical: `/companies?letter=${param(letter)}` },
      }
    : {
        title: "Companies hiring",
        description: "Every company with a role posted on its careers page in the past 3 days, A to Z.",
        alternates: { canonical: "/companies" },
      };
}

/**
 * Every company with an open role, A to Z, one letter per page: the whole
 * list on one page was 1.8 MB. The index leads with who's hiring most.
 */
export default async function Companies(props: PageProps<"/companies">) {
  const letter = pick((await props.searchParams).letter);
  const companies = await companiesWithJobs();
  const counts = new Map<string, number>();
  for (const c of companies) counts.set(letterOf(c.name), (counts.get(letterOf(c.name)) ?? 0) + 1);
  const shown = letter
    ? companies.filter((c) => letterOf(c.name) === letter)
    : [...companies].sort((a, b) => b.n - a.n).slice(0, 60);

  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <header className="rise">
        <h1 className={H1}>{letter ? `Companies: ${letter === "#" ? "0 to 9" : letter}` : "Companies hiring"}</h1>
        <p className={`${LEAD} mt-4`}>
          {companies.length.toLocaleString("en-US")} companies posted a role on their careers page in the past 3 days.
        </p>
      </header>
      <nav aria-label="Companies by letter" className="mt-8 flex flex-wrap gap-1.5">
        <Link
          href="/companies"
          aria-current={!letter ? "page" : undefined}
          className={`inline-flex h-9 items-center rounded-[10px] px-3 text-sm font-medium transition-colors ${
            !letter ? "bg-accent text-accent-fg" : "border border-line bg-surface text-ink hover:border-line-strong hover:text-ink-strong"
          }`}
        >
          Top hiring
        </Link>
        {LETTERS.map((l) =>
          counts.get(l) ? (
            <Link
              key={l}
              href={`/companies?letter=${param(l)}`}
              aria-current={l === letter ? "page" : undefined}
              className={`inline-flex size-9 items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                l === letter ? "bg-accent text-accent-fg" : "border border-line bg-surface text-ink hover:border-line-strong hover:text-ink-strong"
              }`}
            >
              {l}
            </Link>
          ) : null,
        )}
      </nav>
      <h2 className="mt-12 text-sm font-semibold text-ink-strong">
        {letter ? `${shown.length} companies` : "Hiring the most right now"}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li key={c.slug} className="min-w-0">
            <Link
              href={`/companies/${c.slug}`}
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3.5 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
            >
              <CompanyMark name={c.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-strong group-hover:text-accent-ink">{c.name}</span>
                <span className="block text-[13px] text-muted">
                  {c.n} open {c.n === 1 ? "role" : "roles"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
