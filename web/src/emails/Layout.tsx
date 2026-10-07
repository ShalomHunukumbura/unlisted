import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";

/**
 * The frame every Unlisted email shares: the site's warm monochrome, one
 * column, system fonts (web fonts don't load in most mail apps), inline
 * styles only. Light on purpose: mail apps that darken emails do it well with
 * plain colours, and badly with ones they can't tell apart.
 */
export const color = {
  canvas: "#fbfbfa",
  surface: "#ffffff",
  line: "#eaeaea",
  ink: "#2f3437",
  strong: "#111111",
  muted: "#787774",
  greenBg: "#edf3ec",
  greenInk: "#346538",
  blueBg: "#e1f3fe",
  blueInk: "#1f6c9f",
  yellowBg: "#fbf3db",
  yellowInk: "#956400",
  tagBg: "#f4f3f0",
};

const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const serif = 'Georgia, "Times New Roman", serif';
export const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: color.strong,
        color: color.canvas,
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
        padding: "11px 20px",
        borderRadius: 6,
      }}
    >
      {children}
    </Link>
  );
}

export default function Layout({
  preview,
  children,
  footer,
}: {
  /** The line inboxes show after the subject. */
  preview: string;
  children: React.ReactNode;
  /** Why they got it, and how to stop it. */
  footer: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: color.canvas, margin: 0, padding: "32px 12px", fontFamily: sans }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Text style={{ fontFamily: serif, fontSize: 28, lineHeight: "32px", color: color.strong, margin: "0 0 20px" }}>
            Unlisted
          </Text>
          <Section
            style={{
              backgroundColor: color.surface,
              border: `1px solid ${color.line}`,
              borderRadius: 12,
              padding: "28px 28px 24px",
            }}
          >
            {children}
          </Section>
          <Text style={{ fontSize: 12, lineHeight: "18px", color: color.muted, margin: "16px 4px 0" }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
