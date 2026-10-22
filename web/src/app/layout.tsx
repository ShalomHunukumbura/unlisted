import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import Logo from "@/components/Logo";
import SiteNav from "@/components/SiteNav";
import ScrollToTop from "@/components/ScrollToTop";
import { SITE_URL } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Fresh jobs from 10,000+ company career pages (Greenhouse, Ashby, Lever, Recruitee) in one search. Past 3 days only, every listing links to the employer's own posting.";

export const metadata: Metadata = {
  // Absolute URLs for the social preview image; Vercel sets this variable.
  metadataBase: new URL(SITE_URL),
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
  // Opened from the home screen on an iPhone: full screen, named "Unlisted".
  appleWebApp: { capable: true, title: "Unlisted", statusBarStyle: "default" },
};

// The phone's status bar and Android's task switcher match the page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
  ],
};

const FOOTER = [
  {
    title: "Browse",
    links: [
      { href: "/", label: "All jobs" },
      { href: "/roles", label: "By role" },
      { href: "/locations", label: "By country" },
      { href: "/companies", label: "Companies" },
    ],
  },
  {
    title: "Remote",
    links: [
      { href: "/remote", label: "Remote" },
      { href: "/remote/anywhere", label: "Remote, anywhere" },
      { href: "/remote/sri-lanka", label: "Remote, Sri Lanka" },
    ],
  },
  {
    title: "Unlisted",
    links: [
      { href: "/for-you", label: "For you" },
      { href: "/blog", label: "Blog" },
      { href: "/signin", label: "Sign in" },
    ],
  },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg"
        >
          Skip to jobs
        </a>
        <SiteNav />
        {children}
        <ScrollToTop />
        <footer className="mt-auto border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="max-w-sm">
              <Link href="/" aria-label="Unlisted, home" className="inline-block rounded-md">
                <Logo />
              </Link>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-muted">
                Pulled every two hours from public Greenhouse, Ashby, Lever and Recruitee job boards. Every listing
                links to the employer&apos;s own posting; nothing is applied through this site.
              </p>
            </div>
            {FOOTER.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-[13px] font-semibold text-ink-strong">{group.title}</h2>
                <ul className="mt-3 space-y-2.5 text-sm">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-muted transition-colors hover:text-ink-strong">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </footer>
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
