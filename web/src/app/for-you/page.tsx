import { EnvelopeSimple, Sparkle } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import AccountHint from "@/components/AccountHint";
import JobActions from "@/components/JobActions";
import CompanyMark from "@/components/CompanyMark";
import JobRow, { LIST, ROW, ROW_LINK } from "@/components/JobRow";
import ListMemory from "@/components/ListMemory";
import MoreLink from "@/components/MoreLink";
import ProfileEditor from "@/components/ProfileEditor";
import ProfilePanel from "@/components/ProfilePanel";
import PushAlert from "@/components/PushAlert";
import SignInForm from "@/components/SignInForm";
import { CARD, CHIP, CHIP_ON, H1, LEAD, PAGE } from "@/components/ui";
import { digestAction } from "@/lib/alertActions";
import { describeFilters } from "@/lib/alerts";
import { digestState } from "@/lib/digest";
import { query } from "@/lib/db";
import { matchJobs, type Match } from "@/lib/match";
import { currentProfile, type Profile } from "@/lib/profile";
import { MAX_AGE_DAYS, facets } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For you",
  description: "Roles from company career pages, ranked by your roles, skills and CV.",
  // Personal: each visitor sees their own feed.
  robots: { index: false },
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
    <p className="mt-2.5 inline-flex items-start gap-1.5 rounded-md bg-accent-soft/70 px-2 py-1 text-xs text-ink">
      <Sparkle aria-hidden size={12} weight="fill" className="mt-0.5 shrink-0 text-accent" />
      <span>
        <span className="font-semibold text-accent-ink">Matches</span> {parts.join(", ")}
      </span>
    </p>
  );
}

function Tabs({ tab, saved }: { tab: string; saved: number }) {
  const item = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-[8px] px-3.5 py-1.5 font-medium transition-colors ${
        active ? "bg-surface text-ink-strong shadow-[0_1px_2px_rgb(13_20_33/0.08)]" : "text-muted hover:text-ink-strong"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mt-10 mb-4 inline-flex gap-1 rounded-[10px] border border-line bg-hover p-1 text-sm">
      {item("/for-you", "Matches", tab === "matches")}
      {item("/for-you?tab=saved", `Saved${saved ? ` (${saved})` : ""}`, tab === "saved")}
    </div>
  );
}

async function Saved({ profile }: { profile: Profile }) {
  if (!profile.saved.length) {
    return (
      <p className={`${CARD} px-6 py-16 text-center text-sm text-muted`}>Roles you save show up here, even after they leave the feed.</p>
    );
  }
  // Jobs leave Unlisted three days after they're posted; the employer's link still works for a while.
  const listed = new Set(
    (
      await query<{ id: string }>(`SELECT id::text FROM jobs WHERE id = ANY($1::bigint[]) AND closed_at IS NULL`, [
        profile.saved.map((s) => s.id),
      ])
    ).map((r) => r.id),
  );
  return (
    <ul className={LIST}>
      {profile.saved.map((s) => (
        <li key={s.id} className={ROW}>
          <a
            href={listed.has(s.id) ? `/jobs/${s.id}` : s.apply_url}
            {...(!listed.has(s.id) && { target: "_blank", rel: "noopener noreferrer" })}
            className={ROW_LINK}
          >
            <CompanyMark name={s.company} />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink-strong group-hover:text-accent-ink">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="font-medium text-ink">{s.company}</span>
                {s.location && <>, {s.location}</>}
              </p>
              {!listed.has(s.id) && <p className="mt-1 text-xs text-muted">No longer listed here; opens the employer&apos;s page</p>}
            </div>
          </a>
          <JobActions id={s.id} saved title={s.title} hideable={false} />
        </li>
      ))}
    </ul>
  );
}

/** Before there's anything to rank by: no profile, or an account that hasn't said what it's after. */
function Intro({ countries, email }: { countries: { country: string; n: string }[]; email: string | null }) {
  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <AccountHint signedIn={email !== null} />
      <span aria-hidden className="rise grid size-11 place-items-center rounded-[12px] bg-accent text-accent-fg">
        <Sparkle size={22} weight="fill" />
      </span>
      <h1 className={`${H1} rise mt-5`}>For you</h1>
      <p className={`${LEAD} rise mt-4`}>
        Tell Unlisted what you&apos;re after and every role from the past {MAX_AGE_DAYS} days is ranked by how well it
        fits: the roles you want, the skills you have and, if you add one, your CV.
        {email ? "" : " No account needed."}
      </p>
      <div className="mt-10">
        <ProfileEditor initial={null} countries={countries} />
      </div>
      {email ? (
        <p className="mt-4 text-[13px] text-muted">
          Signed in as {email}. It&apos;s saved to your account, so it&apos;s on every device you sign in on.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          <span>Already have an account?</span>
          <SignInForm label="Sign in" intro="We'll email a link that signs you in on this device. No password." />
        </div>
      )}
    </main>
  );
}

export default async function ForYou(props: PageProps<"/for-you">) {
  const sp = await props.searchParams;
  const [profile, fc] = await Promise.all([currentProfile(), facets()]);
  if (!profile || (!profile.roles.length && !profile.skills.length)) {
    return <Intro countries={fc.countries} email={profile?.email ?? null} />;
  }

  const tab = sp.tab === "saved" ? "saved" : "matches";
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(sp.pages)) || 1));
  const { jobs, more } = tab === "matches" ? await matchJobs(profile, { pages }) : { jobs: [], more: false };
  const savedIds = new Set(profile.saved.map((s) => s.id));
  const hasCv = profile.embedding !== null;
  const digest = profile.email ? await digestState(profile.id) : false;

  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <header className="rise mb-8">
        <h1 className={H1}>For you</h1>
        <p className={`${LEAD} mt-4`}>
          Roles from the past {MAX_AGE_DAYS} days, best fit first: the roles you want, then your skills
          {hasCv ? ", then how close the posting reads to your CV" : ""}. Newer roles get a small lift.
        </p>
      </header>

      <ProfilePanel
        profile={{ roles: profile.roles, skills: profile.skills, prefs: profile.prefs as Record<string, string>, hasCv }}
        prefs={describeFilters(profile.prefs)}
        countries={fc.countries}
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-[13px] text-muted">
        <PushAlert forYou />
        {profile.email && (
          <form action={digestAction.bind(null, !digest)} className="contents">
            <button
              type="submit"
              aria-pressed={digest}
              title={digest ? "Your 10 best matches by email, once a week. Press to stop" : "Get your 10 best matches by email, once a week"}
              className={digest ? CHIP_ON : CHIP}
            >
              <EnvelopeSimple aria-hidden size={15} />
              {digest ? "Weekly email on" : "Weekly email"}
            </button>
          </form>
        )}
        {profile.email ? (
          <Link href="/account" className="transition-colors hover:text-ink-strong">
            Signed in as {profile.email}
          </Link>
        ) : (
          <SignInForm
            label="Sign in to keep it"
            intro="We'll email a link that signs you in. This feed and your saved roles become your account, on every device. No password."
          />
        )}
      </div>
      <AccountHint signedIn={profile.email !== null} />

      <ListMemory />
      <Tabs tab={tab} saved={profile.saved.length} />

      {tab === "saved" ? (
        <Saved profile={profile} />
      ) : (
        <>
          <ul className={jobs.length ? LIST : "hidden"}>
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
            <div className={`${CARD} px-6 py-20 text-center`}>
              <p className="text-lg font-semibold text-ink-strong">Nothing fits yet.</p>
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
