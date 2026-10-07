import { Heading, Link, Section, Text } from "@react-email/components";

import { payLabel, remoteLabel } from "@/components/Tags";
import type { Job } from "@/lib/queries";

import Layout, { Button, color, mono } from "./Layout";

export type AlertJob = Pick<
  Job,
  "id" | "title" | "company_name" | "location_raw" | "remote" | "open_to" | "region" | "country" | "comp_min" | "comp_max" | "comp_currency" | "comp_period"
>;

const TONE = {
  green: [color.greenBg, color.greenInk],
  blue: [color.blueBg, color.blueInk],
  yellow: [color.yellowBg, color.yellowInk],
  neutral: [color.tagBg, color.muted],
} as const;

function Tag({ children, tone = "neutral", isMono = false }: { children: React.ReactNode; tone?: keyof typeof TONE; isMono?: boolean }) {
  const [bg, fg] = TONE[tone];
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: bg,
        color: fg,
        fontSize: 12,
        lineHeight: "16px",
        padding: "2px 6px",
        borderRadius: 5,
        marginRight: 6,
        fontFamily: isMono ? mono : undefined,
      }}
    >
      {children}
    </span>
  );
}

/** One email after a sync: the roles that are new for a saved search. */
export default function AlertEmail({
  what,
  jobs,
  more,
  origin,
  allUrl,
  unsubscribeUrl,
}: {
  what: string;
  jobs: AlertJob[];
  /** The list was cut at the limit: there are more than shown. */
  more: boolean;
  origin: string;
  allUrl: string;
  unsubscribeUrl: string;
}) {
  const count = `${jobs.length}${more ? "+" : ""} new ${jobs.length === 1 ? "role" : "roles"}`;
  const first = jobs[0];
  return (
    <Layout
      preview={`${first.title} at ${first.company_name}${jobs.length > 1 ? ` and ${jobs.length - 1} more` : ""}`}
      footer={
        <>
          You get this because you asked for alerts for {what} on Unlisted.{" "}
          <Link href={unsubscribeUrl} style={{ color: color.muted, textDecoration: "underline" }}>
            Unsubscribe
          </Link>
        </>
      }
    >
      <Text style={{ fontSize: 13, color: color.muted, margin: 0 }}>{what}</Text>
      <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", color: color.strong, margin: "4px 0 8px", fontWeight: 600 }}>
        {count}
      </Heading>
      {jobs.map((job) => {
        const remote = remoteLabel(job);
        const pay = payLabel(job);
        return (
          <Section key={job.id} style={{ borderTop: `1px solid ${color.line}`, padding: "14px 0" }}>
            <Link href={`${origin}/jobs/${job.id}`} style={{ fontSize: 15, fontWeight: 600, color: color.strong, textDecoration: "none" }}>
              {job.title}
            </Link>
            <Text style={{ fontSize: 14, lineHeight: "20px", color: color.muted, margin: "2px 0 0" }}>
              <span style={{ color: color.ink }}>{job.company_name}</span>
              {job.location_raw ? ` · ${job.location_raw}` : ""}
            </Text>
            {(remote || pay) && (
              <Text style={{ margin: "8px 0 0", lineHeight: "20px" }}>
                {/* The space keeps the tags apart in the plain-text part. */}
                {pay && <Tag isMono>{pay}</Tag>}{" "}
                {remote && <Tag tone={remote.tone}>{remote.text}</Tag>}
              </Text>
            )}
          </Section>
        );
      })}
      <Section style={{ borderTop: `1px solid ${color.line}`, paddingTop: 20 }}>
        <Button href={allUrl}>See all matches</Button>
      </Section>
    </Layout>
  );
}
