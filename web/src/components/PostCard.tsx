import Link from "next/link";

import { formatDate, type Post } from "@/lib/blog";

/** A post in a list: its banner, category and date, title, and the first lines. */
export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
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
      <p className="mt-4 flex items-center gap-3 text-[13px] text-muted">
        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">
          {post.category === "Report" ? "Weekly report" : post.category}
        </span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </p>
      <h3 className="mt-2.5 text-balance text-xl font-semibold leading-snug tracking-[-0.025em] text-ink-strong transition-colors group-hover:text-accent-ink">
        {post.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink">{post.description}</p>
    </Link>
  );
}
