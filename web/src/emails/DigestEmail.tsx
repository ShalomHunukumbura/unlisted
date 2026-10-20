import { Heading, Link, Section, Text } from "@react-email/components";

import type { Match } from "@/lib/match";

import { JobRows } from "./AlertEmail";
import Layout, { Button, color } from "./Layout";

/** What a role matched, in a few words. */
function why(job: Match): string | null {
  const hits = [...job.role_hits, ...job.skill_hits.slice(0, 4)];
  return hits.length ? `Matches ${hits.join(", ")}` : null;
}

/** Once a week: the best "For you" matches from the past three days, best fit first. */
export default function DigestEmail({
  jobs,
  origin,
  unsubscribeUrl,
}: {
  jobs: Match[];
  origin: string;
  unsubscribeUrl: string;
}) {
  const first = jobs[0];
  const count = `${jobs.length} ${jobs.length === 1 ? "role" : "roles"}`;
  return (
    <Layout
      preview={`${first.title} at ${first.company_name}${jobs.length > 1 ? ` and ${jobs.length - 1} more` : ""}`}
      footer={
        <>
          You get this once a week because you turned on the weekly email in your Unlisted account.{" "}
          <Link href={unsubscribeUrl} style={{ color: color.muted, textDecoration: "underline" }}>
            Unsubscribe
          </Link>
        </>
      }
    >
      <Text style={{ fontSize: 13, color: color.muted, margin: 0 }}>For you, this week</Text>
      <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", color: color.strong, margin: "4px 0 6px", fontWeight: 600 }}>
        Your best matches this week
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px", color: color.ink, margin: "0 0 10px" }}>
        {count} from the past three days, best fit first, ranked by the roles you want and your skills.
      </Text>
      <JobRows jobs={jobs} origin={origin} note={why} />
      <Section style={{ borderTop: `1px solid ${color.line}`, paddingTop: 20 }}>
        <Button href={`${origin}/for-you`}>See all your matches</Button>
      </Section>
    </Layout>
  );
}
