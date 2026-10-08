import Link from "next/link";

import { countryName } from "@/components/Tags";
import type { ReportStats } from "@/lib/reports";
import { countryLanding } from "@/lib/seo";

const n = (v: number) => v.toLocaleString("en-US");
const usd = (v: number) => `$${Math.round(v / 1000)}K`;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The numbers of one week's report. Every chart is one series in one hue
 * (--chart), so there's no legend: the heading names it, values are written
 * next to the bars in text colours, and each bar has a tooltip.
 */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-serif text-3xl tracking-[-0.01em] text-ink-strong">{title}</h2>
      {note && <p className="mt-1.5 text-sm text-muted">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Label, a bar from the baseline with a 4px rounded end, the value. */
function Bars({ rows }: { rows: { label: React.ReactNode; value: number; title: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
      {rows.map((r, i) => (
        <li key={i} className="contents">
          <span className="truncate text-ink">{r.label}</span>
          {/* The tooltip sits on the bar: a display:contents row has no box to hover. */}
          <span title={r.title} className="h-3 rounded-r-[4px] bg-chart" style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} />
          <span className="text-right font-mono text-xs tabular-nums text-ink-strong">{n(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportBody({ stats }: { stats: ReportStats }) {
  const maxDay = Math.max(...stats.byDay, 1);
  const payMax = Math.max(...stats.pay.map((p) => p.high), 1);
  const payMin = Math.min(...stats.pay.map((p) => p.low), payMax);
  const span = payMax - payMin || 1;

  return (
    <div>
      {/* The headline numbers: tiles, not a chart. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Roles posted", n(stats.roles), `by ${n(stats.companies)} companies`],
          ["Remote", `${pct(stats.remote, stats.roles)}%`, `${n(stats.remote)} roles`],
          ["Remote, anywhere", n(stats.remoteAnywhere), `${pct(stats.remoteAnywhere, stats.remote)}% of remote roles`],
          ["Open to Sri Lanka", n(stats.openToSriLanka), "anywhere, APAC, or naming LK or IN"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1.5 font-serif text-4xl leading-none tracking-[-0.02em] text-ink-strong">{value}</dd>
            <dd className="mt-2 text-xs text-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      <Section title="When they were posted" note="Roles posted each day, UTC. Weekends are always quiet.">
        <div className="flex h-56 items-end gap-2 border-b border-line sm:gap-4" role="img" aria-label={`Roles per day: ${stats.byDay.map((v, i) => `${DAYS[i]} ${v}`).join(", ")}`}>
          {stats.byDay.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${DAYS[i]}: ${n(v)} roles`}>
              <span className="font-mono text-[11px] tabular-nums text-ink">{n(v)}</span>
              <span className="w-full max-w-12 rounded-t-[4px] bg-chart" style={{ height: `${Math.max(2, (v / maxDay) * 85)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 sm:gap-4">
          {DAYS.map((d) => (
            <span key={d} className="flex-1 text-center font-mono text-[11px] text-muted">{d}</span>
          ))}
        </div>
      </Section>

      <Section title="Who posted the most" note="Roles posted this week, one per role however many cities it was posted in.">
        <Bars
          rows={stats.topCompanies.map((c) => ({
            label: (
              <Link href={`/companies/${c.slug}`} className="underline decoration-line underline-offset-4 hover:text-ink-strong hover:decoration-current">
                {c.name}
              </Link>
            ),
            value: c.roles,
            title: `${c.name}: ${n(c.roles)} roles`,
          }))}
        />
      </Section>

      {stats.titles.length > 0 && (
        <Section title="The most posted titles" note="Roles whose title names it.">
          <Bars rows={stats.titles.map((t) => ({ label: t.title, value: t.roles, title: `${t.title}: ${n(t.roles)} roles` }))} />
        </Section>
      )}

      {stats.skills.length > 0 && (
        <Section title="Skills in demand" note="Roles whose posting mentions the skill anywhere.">
          <Bars rows={stats.skills.map((s) => ({ label: s.skill, value: s.roles, title: `${s.skill}: ${n(s.roles)} roles` }))} />
        </Section>
      )}

      {stats.pay.length > 0 && (
        <Section
          title="What they pay"
          note="Base pay in US dollars a year, from postings that state it, taking the middle of each range. The bar is the middle half of postings, the dot the median. Titles with at least 5 postings."
        >
          <ul className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-x-4 gap-y-3 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
            {stats.pay.map((p) => (
              <li key={p.title} className="contents">
                <span className="truncate text-ink">{p.title}</span>
                <span
                  className="relative h-3"
                  title={`${p.title}: median ${usd(p.median)}, middle half of postings ${usd(p.low)} to ${usd(p.high)}, ${p.n} postings`}
                >
                  <span
                    className="absolute inset-y-0 rounded-[4px] bg-chart-soft"
                    style={{ left: `${((p.low - payMin) / span) * 100}%`, width: `${Math.max(1, ((p.high - p.low) / span) * 100)}%` }}
                  />
                  {/* The median, ringed in the surface colour so it reads on the band. */}
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart ring-2 ring-canvas"
                    style={{ left: `${((p.median - payMin) / span) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-ink-strong">{usd(p.median)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-[minmax(0,10rem)_1fr_auto] gap-x-4 font-mono text-[11px] text-muted sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
            <span />
            <span className="flex justify-between">
              <span>{usd(payMin)}</span>
              <span>{usd(payMax)}</span>
            </span>
            <span className="invisible">$000K</span>
          </div>
        </Section>
      )}

      {stats.topCountries.length > 0 && (
        <Section title="Where the roles are" note="Roles with a country on the posting.">
          <Bars
            rows={stats.topCountries.map((c) => ({
              label: (
                <Link href={countryLanding(c.country).path} className="underline decoration-line underline-offset-4 hover:text-ink-strong hover:decoration-current">
                  {countryName(c.country)}
                </Link>
              ),
              value: c.roles,
              title: `${countryName(c.country)}: ${n(c.roles)} roles`,
            }))}
          />
        </Section>
      )}
    </div>
  );
}
