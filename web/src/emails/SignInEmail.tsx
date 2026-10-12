import { Heading, Text } from "@react-email/components";

import Layout, { Button, color } from "./Layout";

/** The sign-in link: signs in whichever device it's clicked on. */
export default function SignInEmail({ link, minutes }: { link: string; minutes: number }) {
  return (
    <Layout
      preview="Sign in to Unlisted with one click"
      footer="If you didn't ask for this, ignore it: the link does nothing unless it's opened and confirmed."
    >
      <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", color: color.strong, margin: "0 0 10px", fontWeight: 600 }}>
        Your sign-in link
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px", color: color.ink, margin: "0 0 22px" }}>
        Open it on the device you want to sign in on. There is no password to remember.
      </Text>
      <Button href={link}>Sign in to Unlisted</Button>
      <Text style={{ fontSize: 13, lineHeight: "20px", color: color.muted, margin: "20px 0 0" }}>
        It works once, for {minutes} minutes.
      </Text>
    </Layout>
  );
}
