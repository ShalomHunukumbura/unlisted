import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Read from disk at request time, so Vercel has to be told to ship them:
  // blog posts (Markdown) and the fonts the blog banners are drawn with.
  outputFileTracingIncludes: {
    "/blog/**": ["./content/**/*", "./src/assets/fonts/**/*"],
    "/sitemap.xml": ["./content/**/*"],
  },
  async headers() {
    return [
      {
        // Browsers check for a new service worker on each visit; never let a
        // cache hand them the old one.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
