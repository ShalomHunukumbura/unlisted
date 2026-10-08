import type { Metadata } from "next";
import Link from "next/link";

import PostCard from "@/components/PostCard";
import { CHIP } from "@/components/ui";
import { CATEGORIES, allPosts, formatDate } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Weekly hiring numbers from 7,700 company career pages, and guides to finding the roles that never reach job boards.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

const label = (c: string) => (c === "Report" ? "Weekly reports" : c === "Guide" ? "Guides" : c);

export default async function Blog(props: PageProps<"/blog">) {
  const wanted = (await props.searchParams).category;
  const posts = await allPosts();
  const present = CATEGORIES.filter((c) => posts.some((p) => p.category === c));
  const category = present.find((c) => c.toLowerCase() === wanted);
  const shown = category ? posts.filter((p) => p.category === category) : posts;
  const [featured, ...rest] = shown;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-20 pt-8 sm:pt-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">The Unlisted blog</p>
        <h1 className="mt-3 text-balance font-serif text-5xl leading-[1.02] tracking-[-0.025em] text-ink-strong sm:text-6xl">
          Notes on hiring, from the source.
        </h1>
        <p className="mt-4 text-pretty text-[17px] leading-relaxed text-ink">
          Every week, the numbers from 7,700 company careers pages: who&apos;s hiring, how much is remote, what it
          pays. And guides to finding the roles that never reach job boards.
        </p>
      </header>

      <nav aria-label="Categories" className="mt-8 flex flex-wrap items-center gap-2">
        {[{ href: "/blog", text: "All", active: !category }, ...present.map((c) => ({ href: `/blog?category=${c.toLowerCase()}`, text: label(c), active: c === category }))].map(
          (l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={l.active ? "inline-flex items-center rounded-full bg-ink-strong px-3 py-1.5 text-xs text-canvas" : CHIP}
            >
              {l.text}
            </Link>
          ),
        )}
        <a href="/blog/rss.xml" className={`${CHIP} ml-auto`} title="Follow the blog in a feed reader">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
            <path d="M3 3a10 10 0 0110 10M3 7.5A5.5 5.5 0 018.5 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="3.75" cy="12.25" r="1.25" fill="currentColor" />
          </svg>
          RSS
        </a>
      </nav>

      {!featured ? (
        <p className="py-24 text-center text-sm text-muted">Nothing here yet. The first weekly report comes out on Monday.</p>
      ) : (
        <>
          {/* The newest post, large. */}
          <Link href={`/blog/${featured.slug}`} className="group mt-10 grid items-center gap-6 md:grid-cols-[1.3fr_1fr] md:gap-10">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated banner */}
              <img
                src={`/blog/${featured.slug}/banner`}
                alt=""
                width={1200}
                height={630}
                className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              />
            </div>
            <div>
              <p className="flex gap-2 font-mono text-xs text-muted">
                <span className="text-chart">{featured.category === "Report" ? "Weekly report" : featured.category}</span>
                <span aria-hidden>·</span>
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
              </p>
              <h2 className="mt-3 text-balance font-serif text-4xl leading-[1.05] tracking-[-0.015em] text-ink-strong">
                {featured.title}
              </h2>
              <p className="mt-3 text-pretty leading-relaxed text-ink">{featured.description}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-strong">
                Read it
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </Link>

          {rest.length > 0 && (
            <ul className="mt-16 grid gap-x-6 gap-y-12 border-t border-line pt-12 sm:grid-cols-2">
              {rest.map((p) => (
                <li key={p.slug}>
                  <PostCard post={p} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
