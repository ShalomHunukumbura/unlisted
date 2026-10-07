import type { Metadata } from "next";
import Link from "next/link";

import JobActions from "@/components/JobActions";
import JobRow, { ROW, ROW_LINK } from "@/components/JobRow";
import MoreLink from "@/components/MoreLink";
import ProfileEditor from "@/components/ProfileEditor";
import ProfilePanel from "@/components/ProfilePanel";
import PushAlert from "@/components/PushAlert";
import SignInForm from "@/components/SignInForm";
import { describeFilters } from "@/lib/alerts";
import { query } from "@/lib/db";
import { matchJobs, type Match } from "@/lib/match";
import { currentProfile, type Profile } from "@/lib/profile";
import { MAX_AGE_DAYS, facets } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For you",
  description: "Roles from company career pages, ranked by your roles, skills and CV.",
};

const MAX_PAGES = 10;

/** What matched, in words, under each role. */
function Why({ job }: { job: Match }) {
  const parts: string[] = [];
  if (job.role_hits.length) parts.push(job.role_hits.join(", "));
  if (job.skill_hits.length) {
    const shown = job.skill_hits.slice(0, 5).join(", ");
    parts.push(job.skill_hits.length > 5 ? `${shown} +${job.skill_hits.length - 5}` : shown);
  }
  if (job.similarity !== null && job.similarity >= 0.45) parts.push("close to your CV");
  else if (job.similarity !== null && job.similarity >= 0.4) parts.push("similar to your CV");
  if (!parts.length) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      <span className="text-green-ink">Matches</span> {parts.join(" · ")}
    </p>
  );
}

function Tabs({ tab, saved }: { tab: string; saved: number }) {
  const item = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-1 pb-2.5 transition-colors ${
        active ? "border-ink-strong font-medium text-ink-strong" : "border-transparent text-muted hover:text-ink-strong"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mt-8 flex gap-6 border-b border-line text-sm">
      {item("/for-you", "Matches", tab === "matches")}
      {item("/for-you?tab=saved", `Saved${saved ? ` (${saved})` : ""}`, tab === "saved")}
    </div>
  );
}

async function Saved({ profile }: { profile: Profile }) {
  if (!profile.saved.length) {
    return <p className="py-16 text-center text-sm text-muted">Roles you save show up here, even after they leave the feed.</p>;
  }
  // Jobs leave Unlisted a week after they're posted; the employer's link still works for a while.
  const listed = new Set(
    (
      await query<{ id: string }>(`SELECT id::text FROM jobs WHERE id = ANY($1::bigint[]) AND closed_at IS NULL`, [
        profile.saved.map((s) => s.id),
      ])
    ).map((r) => r.id),
  );
  return (
    <ul>
      {profile.saved.map((s) => (
        <li key={s.id} className={ROW}>
          <a
            href={listed.has(s.id) ? `/jobs/${s.id}` : s.apply_url}
            {...(!listed.has(s.id) && { target: "_blank", rel: "noopener noreferrer" })}
            className={ROW_LINK}
          >
            <div className="min-w-0">
              <h2 className="text-[15px] font-medium leading-snug text-ink-strong">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="text-ink">{s.company}</span>
                {s.location && <> · {s.location}</>}
                {!listed.has(s.id) && <> · no longer listed here, opens the employer&apos;s page</>}
              </p>
            </div>
          </a>
          <JobActions id={s.id} saved title={s.title} hideable={false} />
        </li>
      ))}
    </ul>
  );
}

function Intro({ countries }: { countries: { country: string; n: string }[] }) {
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">For you</h1>
      <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink">
        Tell Unlisted what you&apos;re after and every role from the past {MAX_AGE_DAYS} days is ranked by how well it
        fits: the roles you want, the skills you have and, if you add one, your CV. No account needed.
      </p>
      <div className="mt-8">
        <ProfileEditor initial={null} countries={countries} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span>Set one up on another device?</span>
        <SignInForm
          label="Sign in with email"
          intro="If you linked an email address to your profile, we'll send a link that opens it here."
        />
      </div>
    </main>
  );
}

export default async function ForYou(props: PageProps<"/for-you">) {
  const sp = await props.searchParams;
  const [profile, fc] = await Promise.all([currentProfile(), facets()]);
  if (!profile) return <Intro countries={fc.countries} />;

  const tab = sp.tab === "saved" ? "saved" : "matches";
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(sp.pages)) || 1));
  const { jobs, more } = tab === "matches" ? await matchJobs(profile, { pages }) : { jobs: [], more: false };
  const savedIds = new Set(profile.saved.map((s) => s.id));
  const hasCv = profile.embedding !== null;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <header className="mb-6">
        <h1 className="font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">For you</h1>
        <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink">
          Roles from the past {MAX_AGE_DAYS} days, best fit first: the roles you want, then your skills
          {hasCv ? ", then how close the posting reads to your CV" : ""}. Newer roles get a small lift.
        </p>
      </header>

      <ProfilePanel
        profile={{ roles: profile.roles, skills: profile.skills, prefs: profile.prefs as Record<string, string>, hasCv }}
        prefs={describeFilters(profile.prefs)}
        countries={fc.countries}
      />

      <div className="mt-5 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs text-muted">
        <PushAlert forYou />
        <SignInForm
          label={profile.email ? `Linked to ${profile.email}` : "Use on another device"}
          intro={
            profile.email
              ? "Open this profile on another device: we'll email a link to the address it's linked to."
              : "We'll email a link that opens this profile on any device. The address is only used for sign-in links."
          }
        />
      </div>

      <Tabs tab={tab} saved={profile.saved.length} />

      {tab === "saved" ? (
        <Saved profile={profile} />
      ) : (
        <>
          <ul>
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                why={<Why job={job} />}
                aside={<JobActions id={job.id} saved={savedIds.has(job.id)} title={job.title} />}
              />
            ))}
          </ul>
          {jobs.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-serif text-2xl text-ink-strong">Nothing fits yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                No role in the past {MAX_AGE_DAYS} days matches your roles or enough of your skills with these
                preferences. Try adding a role or more skills, or loosening where and pay.
              </p>
            </div>
          )}
          {more && pages < MAX_PAGES && (
            <div className="mt-10 flex justify-center">
              <MoreLink href={`/for-you?pages=${pages + 1}`} label="Show more matches" />
            </div>
          )}
        </>
      )}
    </main>
  );
}
