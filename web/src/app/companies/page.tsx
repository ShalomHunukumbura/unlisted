import type { Metadata } from "next";
import Link from "next/link";

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
        description: `Companies starting with ${letter === "#" ? "a number" : letter} with a role posted on their careers page in the past week.`,
        alternates: { canonical: `/companies?letter=${param(letter)}` },
      }
    : {
        title: "Companies hiring",
        description: "Every company with a role posted on its careers page in the past week, A to Z.",
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
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-serif text-4xl tracking-[-0.02em] text-ink-strong sm:text-5xl">
        {letter ? `Companies: ${letter === "#" ? "0 to 9" : letter}` : "Companies hiring"}
      </h1>
      <p className="mt-3 text-[15px] text-ink">
        {companies.length.toLocaleString("en-US")} companies posted a role on their careers page in the past week.
      </p>
      <nav aria-label="Companies by letter" className="mt-6 flex flex-wrap gap-1">
        {LETTERS.map((l) =>
          counts.get(l) ? (
            <Link
              key={l}
              href={`/companies?letter=${param(l)}`}
              aria-current={l === letter ? "page" : undefined}
              className={`inline-flex size-8 items-center justify-center rounded-md font-mono text-sm transition-colors ${
                l === letter ? "bg-ink-strong text-canvas" : "text-ink hover:bg-hover"
              }`}
            >
              {l}
            </Link>
          ) : null,
        )}
      </nav>
      <h2 className="mt-10 border-b border-line pb-2 text-sm font-medium text-ink-strong">
        {letter ? `${shown.length} companies` : "Hiring the most this week"}
      </h2>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        {shown.map((c) => (
          <li key={c.slug} className="flex min-w-0 justify-between gap-3">
            <Link href={`/companies/${c.slug}`} className="truncate text-ink hover:text-ink-strong hover:underline">
              {c.name}
            </Link>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{c.n}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
