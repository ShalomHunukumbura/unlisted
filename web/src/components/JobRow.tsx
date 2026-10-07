import Link from "next/link";

import { Tag, payLabel, remoteLabel } from "@/components/Tags";
import { expLabel } from "@/lib/experience";
import type { Job } from "@/lib/queries";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

/** The row hover: a background behind the whole row, buttons included. */
export const ROW =
  "group relative isolate flex items-start gap-2 border-b border-line has-[[data-hidden]]:h-12 has-[[data-hidden]]:overflow-hidden";
export const ROW_LINK =
  "flex min-w-0 flex-1 gap-4 py-4 after:absolute after:inset-y-0 after:-inset-x-3 after:-z-10 after:rounded-lg after:transition-colors after:duration-200 group-hover:after:bg-hover group-has-[[data-hidden]]:after:hidden";

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
    <li className={ROW}>
      <Link href={`/jobs/${job.id}`} className={ROW_LINK}>
        <div className="min-w-0 flex-1">
          <h2 className="text-pretty text-[15px] font-medium leading-snug text-ink-strong">
            {job.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="text-ink">{job.company_name}</span>
            {job.location_raw && <> · {job.location_raw}</>}
            {more && <span className="text-ink"> · {more}</span>}
          </p>
          {(remote || job.remote_scope === "hybrid" || job.department || exp || pay) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
        <time
          dateTime={job.posted_at ?? undefined}
          className="shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted"
        >
          {timeAgo(job.posted_at)}
        </time>
      </Link>
      {aside}
    </li>
  );
}
