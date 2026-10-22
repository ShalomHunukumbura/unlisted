import type { Metadata } from "next";
import { BellSimple, BookmarkSimple, CaretRight, EnvelopeSimple, Sparkle, SuitcaseSimple } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import DeleteAccount from "@/components/DeleteAccount";
import { CARD, H1, PAGE, PRIMARY, SECONDARY } from "@/components/ui";
import { digestAction } from "@/lib/alertActions";
import { digestState } from "@/lib/digest";
import { signOutAction } from "@/lib/forYouActions";
import { alertsFor } from "@/lib/alerts";
import { countApplications } from "@/lib/applications";
import { currentProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const ROW = "group flex items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-hover/70";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
      {children}
    </span>
  );
}

const Chevron = () => (
  <CaretRight aria-hidden size={16} className="ml-auto shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
);

/** Who's signed in, where their things are, and the way out. */
export default async function Account() {
  const profile = await currentProfile();
  if (!profile?.email) redirect("/signin");
  const setUp = profile.roles.length > 0 || profile.skills.length > 0;
  const [applications, alerts, digest] = await Promise.all([
    countApplications(profile.id),
    alertsFor(profile.email),
    digestState(profile.id),
  ]);
  const alertsOn = alerts.filter((a) => a.state === "on").length;

  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <h1 className={`${H1} rise`}>Your account</h1>
      <p className="mt-3 text-[15px] text-ink">
        Signed in as <span className="font-semibold text-ink-strong">{profile.email}</span>
      </p>

      <ul className={`${CARD} mt-10 max-w-2xl divide-y divide-line overflow-hidden`}>
        <li>
          <Link href="/for-you" className={ROW}>
            <Icon><Sparkle size={20} weight="fill" /></Icon>
            <span className="min-w-0">
              <span className="font-semibold text-ink-strong">For you</span>
              <span className="mt-0.5 block text-muted">
                {setUp
                  ? profile.roles.length
                    ? profile.roles.join(", ")
                    : `${profile.skills.length} ${profile.skills.length === 1 ? "skill" : "skills"}`
                  : "Add the roles you want and your skills to get a ranked feed"}
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link href="/for-you?tab=saved" className={ROW}>
            <Icon><BookmarkSimple size={20} /></Icon>
            <span className="min-w-0">
              <span className="font-semibold text-ink-strong">Saved roles</span>
              <span className="mt-0.5 block text-muted">
                {profile.saved.length ? `${profile.saved.length} saved` : "Nothing saved yet"}
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link href="/account/applications" className={ROW}>
            <Icon><SuitcaseSimple size={20} /></Icon>
            <span className="min-w-0">
              <span className="font-semibold text-ink-strong">Applications</span>
              <span className="mt-0.5 block text-muted">
                {applications ? `${applications} tracked` : "Keep track of where you've applied"}
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link href="/account/alerts" className={ROW}>
            <Icon><BellSimple size={20} /></Icon>
            <span className="min-w-0">
              <span className="font-semibold text-ink-strong">Email alerts</span>
              <span className="mt-0.5 block text-muted">
                {alerts.length
                  ? `${alertsOn} on${alerts.length > alertsOn ? `, ${alerts.length - alertsOn} off` : ""}`
                  : "Follow a search and get new matches by email"}
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
        <li className="flex items-center gap-4 px-5 py-4 text-sm">
          <Icon><EnvelopeSimple size={20} /></Icon>
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-ink-strong">Weekly email</span>
            <span className="mt-0.5 block text-muted">
              {digest
                ? "On: your 10 best For you matches, once a week"
                : setUp
                  ? "Your 10 best For you matches, once a week"
                  : "Your best matches once a week. Set up For you first"}
            </span>
          </span>
          <form action={digestAction.bind(null, !digest)}>
            <button
              type="submit"
              className={digest ? `${SECONDARY} px-3.5 py-2` : `${PRIMARY} px-3.5 py-2`}
            >
              {digest ? "Turn off" : "Turn on"}
            </button>
          </form>
        </li>
      </ul>

      <div className="mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className={SECONDARY}
          >
            Sign out
          </button>
        </form>
        <DeleteAccount />
      </div>
    </main>
  );
}
