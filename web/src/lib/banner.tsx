import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { formatDate, type Category, type Post } from "./blog";

/**
 * The banner on every blog post, also its preview image when shared: drawn
 * from the post itself, so every post has one and they all match. 1200 × 630.
 */
export const BANNER = { width: 1200, height: 630 };

type Theme = { bg: string; ink: string; muted: string; accent: string; glow: string; chipBg: string; chipLine: string };

// Cool, light grounds per category, all with the site's pine; reports are the
// one dark banner, so the weekly numbers stand out in the list.
const PINE = "#0b7a68";
const THEMES: Record<Category, Theme> = {
  Report: { bg: "#0d1421", ink: "#eef2f7", muted: "#8892a3", accent: "#34c3a6", glow: "rgba(52,195,166,0.20)", chipBg: "#17202e", chipLine: "#2a3444" },
  Guide: { bg: "#e9f4f1", ink: "#0d1421", muted: "#5d6b7a", accent: PINE, glow: "rgba(11,122,104,0.14)", chipBg: "#ffffff", chipLine: "#cfe5df" },
  Remote: { bg: "#eaf0f8", ink: "#0d1421", muted: "#5f6b80", accent: "#2a5bb8", glow: "rgba(42,91,184,0.13)", chipBg: "#ffffff", chipLine: "#d3deef" },
  Companies: { bg: "#f1f3f6", ink: "#0d1421", muted: "#667085", accent: PINE, glow: "rgba(11,122,104,0.12)", chipBg: "#ffffff", chipLine: "#dde1e7" },
  Tech: { bg: "#eef0f4", ink: "#0d1421", muted: "#667085", accent: "#0d1421", glow: "rgba(13,20,33,0.08)", chipBg: "#ffffff", chipLine: "#d9dde4" },
  Market: { bg: "#e7f2ef", ink: "#0d1421", muted: "#5d6b7a", accent: PINE, glow: "rgba(11,122,104,0.16)", chipBg: "#ffffff", chipLine: "#cfe5df" },
};

const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));
const fonts = Promise.all([
  font("Geist-Regular.ttf"),
  font("Geist-Medium.ttf"),
  font("GeistMono-Regular.ttf"),
]);

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A week's roles per day, as bars. */
function DayBars({ values, theme }: { values: number[]; theme: Theme }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 300 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: Math.max(6, Math.round((v / max) * 250)),
              background: theme.accent,
              borderRadius: "4px 4px 0 0",
              opacity: i >= 5 ? 0.55 : 1,
            }}
          />
          <div style={{ fontFamily: "Geist Mono", fontSize: 18, color: theme.muted }}>{DAYS[i]}</div>
        </div>
      ))}
    </div>
  );
}

/** Remote tags keep the site's colours: pine anywhere, blue a region, amber one country. */
function dotColor(chip: string, theme: Theme) {
  if (/anywhere/i.test(chip)) return PINE;
  if (/\bonly\b/i.test(chip)) return "#8a5a00";
  if (/APAC|EMEA|LATAM|region/i.test(chip)) return "#2a5bb8";
  return theme.accent;
}

/** The post's chips as the site's own tag pills, loosely stacked. */
function Chips({ chips, theme }: { chips: string[]; theme: Theme }) {
  const tilt = [-4, 3, -2];
  const shift = [0, 56, 18];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
      {chips.map((c, i) => (
        <div
          key={c}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginLeft: shift[i],
            transform: `rotate(${tilt[i]}deg)`,
            background: theme.chipBg,
            border: `1.5px solid ${theme.chipLine}`,
            borderRadius: 14,
            padding: "16px 24px",
            fontFamily: "Geist",
            fontWeight: 500,
            fontSize: 28,
            color: theme.ink,
            boxShadow: "0 18px 40px -22px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: dotColor(c, theme) }} />
          {c}
        </div>
      ))}
    </div>
  );
}

export async function banner(post: Post) {
  const theme = THEMES[post.category];
  const [sans, sansMedium, mono] = await fonts;
  const size = post.title.length > 90 ? 54 : post.title.length > 60 ? 64 : 76;
  const chips = post.chips.length ? post.chips : [post.category];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "60px 72px",
          background: theme.bg,
          backgroundImage: `radial-gradient(circle at 88% 12%, ${theme.glow}, transparent 55%)`,
          color: theme.ink,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: theme === THEMES.Report ? "#34c3a6" : PINE }} />
              <div style={{ fontWeight: 500, fontSize: 36, letterSpacing: "-0.03em" }}>Unlisted</div>
            </div>
            <div style={{ fontSize: 22, color: theme.muted }}>Blog</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingRight: 40 }}>
            <div
              style={{
                display: "flex",
                fontWeight: 500,
                fontSize: 22,
                color: theme.accent,
              }}
            >
              {post.category === "Report" ? "Weekly report" : post.category}
            </div>
            <div
              style={{
                fontWeight: 500,
                fontSize: size - 6,
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
              }}
            >
              {post.title}
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, color: theme.muted }}>
            {`${formatDate(post.date)}, findunlisted.link`}
          </div>
        </div>
        <div style={{ display: "flex", width: 340, alignItems: "center", justifyContent: "center" }}>
          {post.report ? <DayBars values={post.report.byDay} theme={theme} /> : <Chips chips={chips} theme={theme} />}
        </div>
      </div>
    ),
    {
      ...BANNER,
      fonts: [
        { name: "Geist", data: sans, weight: 400 },
        { name: "Geist", data: sansMedium, weight: 500 },
        { name: "Geist Mono", data: mono, weight: 400 },
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
