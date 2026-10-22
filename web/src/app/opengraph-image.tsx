import { ImageResponse } from "next/og";

// The preview card when the site is shared (LinkedIn, WhatsApp, Slack…).
// Static: no live numbers, so it never shows a stale count.
export const alt = "Unlisted: jobs straight from company career pages";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f7f8fa",
          backgroundImage: "radial-gradient(circle at 88% 0%, rgba(11,122,104,0.16), transparent 55%)",
          color: "#0d1421",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "#0b7a68" }} />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>Unlisted</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1.04, maxWidth: 960 }}>
            Jobs straight from company career pages.
          </div>
          <div style={{ fontSize: 30, marginTop: 24, color: "#667085" }}>findunlisted.link</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26 }}>
          {[
            ["10,000+ company career pages", "#e4f3ef", "#075e50"],
            ["Past 3 days only", "#e8effb", "#2a5bb8"],
            ["Remote filter for Sri Lanka", "#fbf1dc", "#8a5a00"],
          ].map(([text, bg, fg]) => (
            <div
              key={text}
              style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", background: bg, color: fg, padding: "12px 20px", borderRadius: 10 }}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
