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
          background: "#fbfbfa",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#787774" }}>unlisted-tau.vercel.app</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, letterSpacing: "-0.04em", lineHeight: 1 }}>Unlisted</div>
          <div style={{ fontSize: 44, marginTop: 24, color: "#2f3437", maxWidth: 900 }}>
            Jobs straight from company career pages.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26 }}>
          {[
            ["7,700+ company career pages", "#edf3ec", "#346538"],
            ["Past week only", "#e1f3fe", "#1f6c9f"],
            ["Remote filter for Sri Lanka", "#fbf3db", "#956400"],
          ].map(([text, bg, fg]) => (
            <div
              key={text}
              style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", background: bg, color: fg, padding: "12px 20px", borderRadius: 8 }}
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
