import { ArrowRight, Bell, EnvelopeSimple, Globe, Rss, Sparkle } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import CompanyMark from "@/components/CompanyMark";
import { Tag } from "@/components/Tags";
import { PAGE } from "@/components/ui";

function More({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "light" }) {
  return (
    <span
      className={`mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold ${tone === "light" ? "text-white" : "text-accent-ink"}`}
    >
      {children}
      <ArrowRight aria-hidden size={15} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
    </span>
  );
}

/**
 * What Unlisted does besides the list, on the home page only: For you, alerts,
 * and remote tags. Each tile shows a piece of the real UI rather than an icon,
 * so it reads as "this is what you'll get".
 */
export default function HomeFeatures({ hasProfile }: { hasProfile: boolean }) {
  return (
    <section aria-label="What you can do here" className={`${PAGE} mt-16 sm:mt-20`}>
      <div className="grid gap-4 md:grid-cols-12">
        {/* For you: the big one, on a pine wash. */}
        <Link
          href="/for-you"
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft p-6 transition-[border-color,transform] duration-300 hover:border-accent/40 sm:p-8 md:col-span-7 md:row-span-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_65%)]"
          />
          <span aria-hidden className="relative grid size-10 place-items-center rounded-[10px] bg-accent text-accent-fg">
            <Sparkle size={20} weight="fill" />
          </span>
          <h2 className="relative mt-5 max-w-md text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.035em] text-ink-strong sm:text-[2.15rem]">
            Upload your CV. Get every role ranked for you.
          </h2>
          <p className="relative mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-ink">
            Ranked by the roles you want, your skills and how close each posting reads to your CV. The CV never
            leaves your device.
          </p>

          {/* A matched row, as the feed shows it. */}
          <div
            aria-hidden
            className="relative mt-8 rounded-2xl border border-line bg-surface p-4 shadow-card transition-transform duration-300 group-hover:-translate-y-1 sm:p-5"
          >
            <div className="flex items-start gap-3.5">
              <CompanyMark name="Canva" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-ink-strong">Senior Data Engineer</p>
                  <span className="font-mono text-xs text-muted">2h ago</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="font-medium text-ink">Canva</span>, Sydney, Australia
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Tag tone="blue">Remote · APAC</Tag>
                  <Tag mono>5+ yrs</Tag>
                </div>
                <p className="mt-3 text-xs text-muted">
                  <span className="font-semibold text-accent-ink">Matches</span> Data Engineer, Python, Spark, dbt,
                  close to your CV
                </p>
              </div>
            </div>
          </div>

          <span className="relative">
            <More>{hasProfile ? "Open your feed" : "Set up your feed in a minute"}</More>
          </span>
        </Link>

        {/* Alerts: the one dark tile, the same in both themes. */}
        <a
          href="#roles"
          className="group flex flex-col rounded-2xl border border-white/5 bg-[#0d1421] p-6 text-white transition-transform duration-300 hover:-translate-y-0.5 sm:p-7 md:col-span-5"
        >
          <span aria-hidden className="grid size-10 place-items-center rounded-[10px] bg-white/10 text-white">
            <Bell size={20} />
          </span>
          <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em]">Follow any search</h3>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-white/70">
            Pick filters once, then get what&apos;s new after every update, every two hours.
          </p>
          <ul aria-hidden className="mt-5 flex flex-wrap gap-2 text-[13px] text-white/85">
            {[
              { Icon: EnvelopeSimple, label: "Email" },
              { Icon: Bell, label: "Notification" },
              { Icon: Rss, label: "RSS" },
            ].map(({ Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/5 px-2.5 py-1.5">
                <Icon size={14} />
                {label}
              </li>
            ))}
          </ul>
          <More tone="light">Find a search to follow</More>
        </a>

        {/* Remote, from where */}
        <Link
          href="/remote/sri-lanka"
          className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong sm:p-7 md:col-span-5"
        >
          <span aria-hidden className="grid size-10 place-items-center rounded-[10px] bg-blue-bg text-blue-ink">
            <Globe size={20} />
          </span>
          <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-ink-strong">Know where you can work from</h3>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Tag tone="green">Remote · anywhere</Tag>
            <Tag tone="blue">Remote · APAC</Tag>
            <Tag tone="yellow">Remote · US only</Tag>
          </div>
          <More>Remote roles open to Sri Lanka</More>
        </Link>
      </div>
    </section>
  );
}
