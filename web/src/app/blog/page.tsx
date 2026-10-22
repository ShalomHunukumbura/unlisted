import type { Metadata } from "next";
import { ArrowRight, Rss } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import PostCard from "@/components/PostCard";
import { CHIP, H1, LEAD, PAGE } from "@/components/ui";
import { CATEGORIES, allPosts, formatDate } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Weekly hiring numbers from 10,000 company career pages, and guides to finding the roles that never reach job boards.",
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
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <header className="rise max-w-3xl">
        <h1 className={H1}>Notes on hiring, from the source.</h1>
        <p className={`${LEAD} mt-4`}>
          Every week, the numbers from 10,000 company careers pages: who&apos;s hiring, how much is remote, what it
          pays. And guides to finding the roles that never reach job boards.
        </p>
      </header>

      <nav aria-label="Categories" className="mt-10 flex flex-wrap items-center gap-2 border-b border-line pb-6">
        {[{ href: "/blog", text: "All", active: !category }, ...present.map((c) => ({ href: `/blog?category=${c.toLowerCase()}`, text: label(c), active: c === category }))].map(
          (l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={l.active ? "inline-flex items-center rounded-[10px] bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-fg" : CHIP}
            >
              {l.text}
            </Link>
          ),
        )}
        <a href="/blog/rss.xml" className={`${CHIP} ml-auto`} title="Follow the blog in a feed reader">
<Rss aria-hidden size={15} />
          RSS
        </a>
      </nav>

      {!featured ? (
        <p className="py-24 text-center text-sm text-muted">Nothing here yet. The first weekly report comes out on Monday.</p>
      ) : (
        <>
          {/* The newest post, large. */}
          <Link href={`/blog/${featured.slug}`} className="group mt-10 grid items-center gap-6 md:grid-cols-[1.35fr_1fr] md:gap-12">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
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
              <p className="flex items-center gap-3 text-[13px] text-muted">
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">
                  {featured.category === "Report" ? "Weekly report" : featured.category}
                </span>
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
              </p>
              <h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.035em] text-ink-strong transition-colors group-hover:text-accent-ink sm:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-3 text-pretty leading-relaxed text-ink">{featured.description}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
                Read it
                <ArrowRight aria-hidden size={15} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {rest.length > 0 && (
            <ul className="mt-16 grid gap-x-8 gap-y-14 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-3">
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
