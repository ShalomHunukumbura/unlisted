import Link from "next/link";

import { formatDate, type Post } from "@/lib/blog";

/** A post in a list: its banner, category and date, title, and the first lines. */
export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated banner */}
        <img
          src={`/blog/${post.slug}/banner`}
          alt=""
          width={1200}
          height={630}
          loading="lazy"
          className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
        />
      </div>
      <p className="mt-4 flex gap-2 font-mono text-xs text-muted">
        <span className="text-chart">{post.category === "Report" ? "Weekly report" : post.category}</span>
        <span aria-hidden>·</span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </p>
      <h3 className="mt-2 text-balance font-serif text-2xl leading-tight text-ink-strong">{post.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink">{post.description}</p>
    </Link>
  );
}
