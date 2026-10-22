import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";

/**
 * The frame every Unlisted email shares: the site's Ink & Pine palette, one
 * column, system fonts (web fonts don't load in most mail apps), inline
 * styles only. Light on purpose: mail apps that darken emails do it well with
 * plain colours, and badly with ones they can't tell apart.
 */
export const color = {
  canvas: "#f7f8fa",
  surface: "#ffffff",
  line: "#e3e6eb",
  ink: "#3b4453",
  strong: "#0d1421",
  muted: "#667085",
  accent: "#0b7a68",
  greenBg: "#e4f3ef",
  greenInk: "#075e50",
  blueBg: "#e8effb",
  blueInk: "#2a5bb8",
  yellowBg: "#fbf1dc",
  yellowInk: "#8a5a00",
  tagBg: "#f0f2f5",
};

const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: color.accent,
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
        padding: "11px 20px",
        borderRadius: 10,
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
          <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: "28px", color: color.strong, margin: "0 0 20px" }}>
            <span style={{ color: color.accent }}>■</span> Unlisted
          </Text>
          <Section
            style={{
              backgroundColor: color.surface,
              border: `1px solid ${color.line}`,
              borderRadius: 16,
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
