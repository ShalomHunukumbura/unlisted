import type { MetadataRoute } from "next";

// What "Add to Home Screen" / "Install app" uses.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Unlisted · jobs straight from company career pages",
    short_name: "Unlisted",
    description: "Fresh jobs from 7,700+ company career pages in one search, with alerts for new roles.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
