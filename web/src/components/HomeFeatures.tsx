import Link from "next/link";

import { Tag } from "@/components/Tags";

/**
 * What Unlisted does besides the list, on the home page only: For you, alerts,
 * and remote tags. Each tile shows a piece of the real UI rather than an icon,
 * so it reads as "this is what you'll get".
 */
export default function HomeFeatures({ hasProfile }: { hasProfile: boolean }) {
  return (
    <section aria-label="What you can do here" className="mt-12 grid gap-3 md:grid-cols-5">
      {/* For you: the big one */}
      <Link
        href="/for-you"
        className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-muted sm:p-7 md:col-span-3 md:row-span-2"
      >
        {/* A soft warm glow, top right: depth without a gradient fill. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-yellow-bg opacity-70 blur-3xl"
        />
        <p className="relative font-mono text-xs uppercase tracking-[0.08em] text-muted">For you</p>
        <h2 className="relative mt-3 max-w-md text-balance font-serif text-3xl leading-[1.1] tracking-[-0.01em] text-ink-strong sm:text-4xl">
          Upload your CV. Get every role ranked for you.
        </h2>
        <p className="relative mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink">
          The roles you want, the skills you have, and how close each posting reads to your CV. The CV is
          read on your device and never uploaded. No account.
        </p>

        {/* A matched row, as the feed shows it. */}
        <div
          aria-hidden
          className="relative mt-6 rounded-xl border border-line bg-canvas p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)] transition-transform duration-300 group-hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink-strong">Senior Data Engineer</p>
              <p className="mt-0.5 text-sm text-muted">
                <span className="text-ink">Canva</span> · Sydney, Australia
              </p>
            </div>
            <span className="font-mono text-xs text-muted">2h ago</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Tag tone="blue">Remote · APAC</Tag>
            <Tag mono>5+ yrs</Tag>
          </div>
          <p className="mt-2.5 text-xs text-muted">
            <span className="text-green-ink">Matches</span> Data Engineer · Python, Spark, dbt · close to your CV
          </p>
        </div>

        <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-strong">
          {hasProfile ? "Open your feed" : "Set up your feed, about a minute"}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>

      {/* Alerts */}
      <a
        href="#roles"
        className="group rounded-2xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-muted md:col-span-2"
      >
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Alerts</p>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-ink-strong">Follow any search</h3>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-ink">
          Search or pick filters, then get what&apos;s new by email or as a phone notification after each hourly
          update.
        </p>
        <div aria-hidden className="mt-4 flex flex-wrap gap-1.5 text-xs text-ink">
          {["Email", "Notification", "RSS"].map((w) => (
            <span key={w} className="rounded-full border border-line bg-canvas px-2.5 py-1">
              {w}
            </span>
          ))}
        </div>
      </a>

      {/* Remote, from where */}
      <Link
        href="/remote/sri-lanka"
        className="group rounded-2xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-muted md:col-span-2"
      >
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Remote, from where?</p>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-ink-strong">Know where you can work from</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="green">Remote · anywhere</Tag>
          <Tag tone="blue">Remote · APAC</Tag>
          <Tag tone="yellow">Remote · US only</Tag>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-strong">
          Remote roles open to Sri Lanka
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </section>
  );
}
