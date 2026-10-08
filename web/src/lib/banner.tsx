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

// Light, warm grounds per category; reports are the one dark banner, so the
// weekly numbers stand out in the list.
const THEMES: Record<Category, Theme> = {
  Report: { bg: "#161615", ink: "#f4f2ee", muted: "#9b9a97", accent: "#c97f57", glow: "rgba(201,127,87,0.22)", chipBg: "#232321", chipLine: "#3a3936" },
  Guide: { bg: "#f3eee6", ink: "#111111", muted: "#787774", accent: "#346538", glow: "rgba(52,101,56,0.12)", chipBg: "#fbfbfa", chipLine: "#e2dcd1" },
  Remote: { bg: "#e9f1f6", ink: "#111111", muted: "#6b7680", accent: "#1f6c9f", glow: "rgba(31,108,159,0.14)", chipBg: "#fbfdfe", chipLine: "#d3e2ec" },
  Companies: { bg: "#f2ebe1", ink: "#111111", muted: "#7a746b", accent: "#956400", glow: "rgba(149,100,0,0.13)", chipBg: "#fbf9f5", chipLine: "#e4dacb" },
  Tech: { bg: "#ebedee", ink: "#111111", muted: "#6f7477", accent: "#2f3437", glow: "rgba(47,52,55,0.10)", chipBg: "#f8f9f9", chipLine: "#d9dcde" },
  Market: { bg: "#f4e6dc", ink: "#111111", muted: "#7d6f66", accent: "#b4663f", glow: "rgba(180,102,63,0.14)", chipBg: "#fcf8f5", chipLine: "#e9d6c8" },
};

const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));
const fonts = Promise.all([
  font("InstrumentSerif-Regular.ttf"),
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

/** Remote tags keep the site's colours: green anywhere, blue a region, amber one country. */
function dotColor(chip: string, theme: Theme) {
  if (/anywhere/i.test(chip)) return "#346538";
  if (/\bonly\b/i.test(chip)) return "#956400";
  if (/APAC|EMEA|LATAM|region/i.test(chip)) return "#1f6c9f";
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
  const [serif, sans, sansMedium, mono] = await fonts;
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
            <div style={{ fontFamily: "Instrument Serif", fontSize: 40, letterSpacing: "-0.01em" }}>Unlisted</div>
            <div style={{ fontSize: 22, color: theme.muted }}>Blog</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingRight: 40 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Geist Mono",
                fontSize: 18,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.accent,
              }}
            >
              {post.category === "Report" ? "Weekly report" : post.category}
            </div>
            <div
              style={{
                fontFamily: "Instrument Serif",
                fontSize: size,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
              }}
            >
              {post.title}
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, color: theme.muted }}>
            {formatDate(post.date)} · findunlisted.link
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
        { name: "Instrument Serif", data: serif, weight: 400 },
        { name: "Geist", data: sans, weight: 400 },
        { name: "Geist", data: sansMedium, weight: 500 },
        { name: "Geist Mono", data: mono, weight: 400 },
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
