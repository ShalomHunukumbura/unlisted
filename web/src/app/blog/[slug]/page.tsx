import type { Metadata } from "next";
import { ArrowRight, CaretRight, Sparkle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import PostCard from "@/components/PostCard";
import ReportBody from "@/components/ReportBody";
import { H2, PAGE, PRIMARY, SECONDARY } from "@/components/ui";
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
    <main id="main" className={`${PAGE} pb-24 pt-8 sm:pt-12`}>
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
        <header className="rise mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
            <Link href="/blog" className="transition-colors hover:text-ink-strong">Blog</Link>
            <CaretRight aria-hidden size={12} />
            <Link href={`/blog?category=${post.category.toLowerCase()}`} className="transition-colors hover:text-ink-strong">
              {post.category === "Report" ? "Weekly reports" : post.category}
            </Link>
          </nav>
          <h1 className="mt-6 text-balance text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.04em] text-ink-strong sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink">{post.description}</p>
          <p className="mt-5 flex flex-wrap gap-x-4 text-[13px] text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>{post.minutes} min read</span>
          </p>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG at a fixed size, nothing for next/image to do */}
        <img
          src={banner}
          alt=""
          width={1200}
          height={630}
          className="mx-auto mt-10 w-full max-w-4xl rounded-2xl border border-line bg-surface shadow-card"
        />

        <div className="mx-auto mt-12 max-w-3xl">
          {post.report && (
            <p className="mb-8 rounded-[10px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-ink">
              Every role posted on company career pages between {weekLabel(post.report.week)}, as Unlisted saw them.
              One role is one company and title, however many cities it was posted in.
            </p>
          )}
          {post.headings.length >= 3 && (
            <nav aria-label="Contents" className="mb-10 border-l-2 border-accent pl-4">
              <p className="text-[13px] font-semibold text-ink-strong">In this post</p>
              <ol className="mt-2 space-y-1 text-sm">
                {post.headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-ink transition-colors hover:text-accent-ink">
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
          <aside className="relative mt-16 overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:p-9">
            <span aria-hidden className="grid size-10 place-items-center rounded-[10px] bg-accent text-accent-fg">
              <Sparkle size={20} weight="fill" />
            </span>
            <p className="mt-5 max-w-lg text-balance text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink-strong sm:text-[1.75rem]">
              Every new role from 10,000 careers pages, ranked for you.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/for-you" className={PRIMARY}>
                Get your personal feed <ArrowRight aria-hidden size={15} weight="bold" />
              </Link>
              <Link href="/" className={SECONDARY}>
                Browse all roles
              </Link>
            </div>
          </aside>
        </div>
      </article>

      {more.length > 0 && (
        <section aria-labelledby="more-title" className="mx-auto mt-24 max-w-4xl border-t border-line pt-12">
          <h2 id="more-title" className={H2}>More from the blog</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2">
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
