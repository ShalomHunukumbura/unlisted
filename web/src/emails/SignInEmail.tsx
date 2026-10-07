import { Heading, Text } from "@react-email/components";

import Layout, { Button, color } from "./Layout";

/** The "For you" sign-in link: opens the profile on whichever device it's clicked. */
export default function SignInEmail({ link, minutes }: { link: string; minutes: number }) {
  return (
    <Layout
      preview="Open your For you feed on this device"
      footer="If you didn't ask for this, ignore it: the link does nothing unless it's opened and confirmed."
    >
      <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", color: color.strong, margin: "0 0 10px", fontWeight: 600 }}>
        Your sign-in link
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px", color: color.ink, margin: "0 0 22px" }}>
        Open it on the device where you want your For you feed, saved roles and preferences.
      </Text>
      <Button href={link}>Open my profile</Button>
      <Text style={{ fontSize: 13, lineHeight: "20px", color: color.muted, margin: "20px 0 0" }}>
        It works once, for {minutes} minutes.
      </Text>
    </Layout>
  );
}
