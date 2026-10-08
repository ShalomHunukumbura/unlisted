import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PostCard from "@/components/PostCard";
import ReportBody from "@/components/ReportBody";
import { PRIMARY } from "@/components/ui";
import { allPosts, formatDate, postBySlug, weekLabel } from "@/lib/blog";
import { SITE_URL, jsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await postBySlug((await props.params).slug);
  if (!post) return {};
  const image = { url: `/blog/${post.slug}/banner`, width: 1200, height: 630, alt: post.title };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.date, images: [image] },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [image.url] },
  };
}

export default async function BlogPost(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const [post, posts] = await Promise.all([postBySlug(slug), allPosts()]);
  if (!post) notFound();
  const more = posts.filter((p) => p.slug !== post.slug).slice(0, 2);
  const banner = `/blog/${post.slug}/banner`;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-20 pt-8 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            image: `${SITE_URL}${banner}`,
            url: `${SITE_URL}/blog/${post.slug}`,
            author: { "@type": "Organization", name: "Unlisted", url: SITE_URL },
            publisher: { "@type": "Organization", name: "Unlisted", url: SITE_URL },
          }),
        }}
      />
      <article>
        <header className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
            <Link href="/blog" className="transition-colors hover:text-ink-strong">Blog</Link>
            <span aria-hidden>/</span>
            <Link href={`/blog?category=${post.category.toLowerCase()}`} className="transition-colors hover:text-ink-strong">
              {post.category === "Report" ? "Weekly reports" : post.category}
            </Link>
          </nav>
          <h1 className="mt-5 text-balance font-serif text-[2.6rem] leading-[1.04] tracking-[-0.025em] text-ink-strong sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink">{post.description}</p>
          <p className="mt-5 flex flex-wrap gap-x-3 font-mono text-xs text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{post.minutes} min read</span>
          </p>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG at a fixed size, nothing for next/image to do */}
        <img
          src={banner}
          alt=""
          width={1200}
          height={630}
          className="mx-auto mt-10 w-full max-w-4xl rounded-2xl border border-line bg-surface"
        />

        <div className="mx-auto mt-12 max-w-3xl">
          {post.report && (
            <p className="mb-8 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
              Every role posted on company career pages between {weekLabel(post.report.week)}, as Unlisted saw them.
              One role is one company and title, however many cities it was posted in.
            </p>
          )}
          {post.headings.length >= 3 && (
            <nav aria-label="Contents" className="mb-10 border-l-2 border-chart pl-4">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">In this post</p>
              <ol className="mt-2 space-y-1 text-sm">
                {post.headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-ink transition-colors hover:text-ink-strong">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {post.html && (
            <div
              className="prose prose-blog max-w-none text-[17px] leading-[1.75] prose-li:my-1 prose-strong:font-medium"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          )}
          {post.report && <ReportBody stats={post.report} />}

          {/* Where to go from here. */}
          <aside className="mt-16 overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Unlisted</p>
            <p className="mt-2 max-w-lg text-balance font-serif text-3xl leading-tight text-ink-strong">
              Every new role from 7,700 careers pages, ranked for you.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/for-you" className={PRIMARY}>
                Get your personal feed <span aria-hidden>→</span>
              </Link>
              <Link href="/" className="text-sm font-medium text-ink-strong underline decoration-line underline-offset-4 hover:decoration-current">
                Browse all roles
              </Link>
            </div>
          </aside>
        </div>
      </article>

      {more.length > 0 && (
        <section aria-labelledby="more-title" className="mx-auto mt-20 max-w-4xl border-t border-line pt-10">
          <h2 id="more-title" className="font-serif text-3xl text-ink-strong">More from the blog</h2>
          <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2">
            {more.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
