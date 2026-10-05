import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Only the wordmark and page titles use it, so one weight is enough.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const description =
  "Fresh jobs from 7,700+ company career pages (Greenhouse, Ashby, Lever) in one search. Past two weeks only, every listing links to the employer's own posting.";

export const metadata: Metadata = {
  // Absolute URLs for the social preview image; Vercel sets this variable.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: {
    default: "Unlisted · jobs straight from company career pages",
    template: "%s · Unlisted",
  },
  description,
  openGraph: {
    title: "Unlisted · jobs straight from company career pages",
    description,
    siteName: "Unlisted",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-ink-strong focus:px-3 focus:py-2 focus:text-sm focus:text-canvas"
        >
          Skip to jobs
        </a>
        {children}
        <footer className="mt-auto border-t border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
            <p className="max-w-xl text-pretty">
              Pulled hourly from public Greenhouse, Ashby and Lever job boards. Every listing
              links to the employer&apos;s own posting; nothing is applied through this site.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}