import { MapPin } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import CompanyMark from "@/components/CompanyMark";
import { Tag, payLabel, remoteLabel } from "@/components/Tags";
import { CARD } from "@/components/ui";
import { expLabel } from "@/lib/experience";
import type { Job } from "@/lib/queries";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

/** The list the rows sit in: one raised card, a hairline between rows. */
export const LIST = `${CARD} divide-y divide-line overflow-hidden`;

/**
 * The row hover: a background behind the whole row, buttons included. A
 * keyboard-focused row (j/k) gets the same, plus an accent bar on the left:
 * the card clips an outline.
 */
export const ROW =
  "group relative isolate flex items-start gap-2 px-4 transition-colors duration-200 hover:bg-hover/70 sm:px-5 has-[>a:focus-visible]:bg-hover/70 has-[>a:focus-visible]:shadow-[inset_3px_0_0_var(--accent)] has-[[data-hidden]]:h-12 has-[[data-hidden]]:overflow-hidden";
export const ROW_LINK = "flex min-w-0 flex-1 gap-3.5 py-4 focus-visible:outline-none sm:gap-4";

/**
 * One role in a list: the home feed and "For you". `why` goes under the tags
 * (what matched), `aside` next to the row, outside the link (buttons can't
 * sit inside one).
 */
export default function JobRow({ job, why, aside }: { job: Job; why?: React.ReactNode; aside?: React.ReactNode }) {
  const remote = remoteLabel(job);
  const exp = expLabel(job.exp_min_years, job.exp_max_years);
  const pay = payLabel(job);
  const more = (job.role_locations ?? 1) > 1
    ? `+${job.role_locations! - 1} more ${job.role_locations === 2 ? "location" : "locations"}`
    : (job.role_postings ?? 1) > 1
      ? `${job.role_postings} openings`
      : null;
  return (
    // data-job and data-seen let ListMemory mark rows new since the last visit, or already opened.
    <li className={ROW} data-job={job.id} data-seen={job.first_seen_at ?? job.posted_at ?? undefined}>
      <Link href={`/jobs/${job.id}`} className={ROW_LINK}>
        <CompanyMark name={job.company_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-pretty text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink-strong transition-colors group-hover:text-accent-ink group-data-[viewed]:font-medium group-data-[viewed]:text-muted">
              <span className="mr-2 hidden translate-y-[-1px] rounded-md bg-accent px-1.5 py-0.5 align-middle text-[11px] font-semibold leading-none text-accent-fg group-data-[new]:inline-block">
                New
              </span>
              {job.title}
            </h2>
            <time
              dateTime={job.posted_at ?? undefined}
              className="shrink-0 pt-0.5 text-xs tabular-nums text-muted"
            >
              {timeAgo(job.posted_at)}
            </time>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
            <span className="font-medium text-ink">{job.company_name}</span>
            {job.location_raw && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin aria-hidden size={14} className="shrink-0" />
                <span className="[overflow-wrap:anywhere]">{job.location_raw}</span>
              </span>
            )}
            {more && <span>{more}</span>}
          </p>
          {(remote || job.remote_scope === "hybrid" || job.department || exp || pay) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {pay && <Tag mono title="Base pay stated on the posting">{pay}</Tag>}
              {remote && <Tag tone={remote.tone} title={remote.title}>{remote.text}</Tag>}
              {job.remote_scope === "hybrid" && <Tag>Hybrid</Tag>}
              {exp && (
                <Tag
                  mono
                  title={job.exp_source === "title" ? "Guessed from the job title" : "Stated in the description"}
                >
                  {job.exp_source === "title" ? `~${exp}` : exp}
                </Tag>
              )}
              {job.department && <Tag>{job.department}</Tag>}
            </div>
          )}
          {why}
        </div>
      </Link>
      {aside}
    </li>
  );
}
