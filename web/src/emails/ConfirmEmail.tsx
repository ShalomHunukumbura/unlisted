import { Heading, Text } from "@react-email/components";

import Layout, { Button, color } from "./Layout";

/** Sent once when someone creates an alert: nothing else goes out until it's clicked. */
export default function ConfirmEmail({ email, what, link }: { email: string; what: string; link: string }) {
  return (
    <Layout
      preview={`One click to start alerts for ${what}`}
      footer="If you didn't ask for this, ignore it: without a click, nothing more is sent."
    >
      <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", color: color.strong, margin: "0 0 10px", fontWeight: 600 }}>
        Confirm your alert
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px", color: color.ink, margin: "0 0 14px" }}>
        Someone, hopefully you, asked Unlisted to email {email} when new roles match this search:
      </Text>
      <Text
        style={{
          fontSize: 15,
          lineHeight: "22px",
          color: color.strong,
          fontWeight: 600,
          backgroundColor: color.canvas,
          border: `1px solid ${color.line}`,
          borderRadius: 8,
          padding: "10px 14px",
          margin: "0 0 22px",
        }}
      >
        {what}
      </Text>
      <Button href={link}>Confirm alert</Button>
      <Text style={{ fontSize: 13, lineHeight: "20px", color: color.muted, margin: "20px 0 0" }}>
        You&apos;ll get one email after an hourly update finds something new, and every email has an unsubscribe
        link.
      </Text>
    </Layout>
  );
}
