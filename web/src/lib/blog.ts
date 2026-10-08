import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import matter from "gray-matter";
import { Marked } from "marked";

import { finishedReports, weekEnd, type ReportStats } from "./reports";

/**
 * The blog: posts are Markdown files in web/content/blog (front matter for
 * the title and the rest), and each finished week's report is a post made
 * from its numbers, with optional words in web/content/reports/<week>.md.
 */

export const CATEGORIES = ["Report", "Guide", "Remote", "Companies", "Tech", "Market"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: Category;
  /** Two or three words drawn as tags on the banner. */
  chips: string[];
  minutes: number;
  html: string;
  headings: { id: string; text: string }[];
  /** Set for the weekly reports. */
  report?: ReportStats;
};

const CONTENT = join(process.cwd(), "content");

const slugify = (text: string) =>
  text.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Heading text for the contents list: marked escapes quotes and the like. */
const decode = (html: string) =>
  html.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Markdown to HTML, with ids on the h2s for the contents list. Posts come from the repo, so they're trusted. */
function render(markdown: string) {
  const headings: Post["headings"] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        if (depth !== 2) return `<h${depth}>${text}</h${depth}>\n`;
        const id = slugify(text);
        headings.push({ id, text: decode(text.replace(/<[^>]+>/g, "")) });
        return `<h2 id="${id}">${text}</h2>\n`;
      },
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false });
  const words = markdown.split(/\s+/).length;
  return { html, headings, minutes: Math.max(1, Math.round(words / 220)) };
}

async function readPosts(): Promise<Post[]> {
  let files: string[] = [];
  try {
    files = (await readdir(join(CONTENT, "blog"))).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const posts = await Promise.all(
    files.map(async (file) => {
      const { data, content } = matter(await readFile(join(CONTENT, "blog", file), "utf8"));
      if (data.draft) return null;
      const category = CATEGORIES.includes(data.category) ? (data.category as Category) : "Guide";
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title),
        description: String(data.description ?? ""),
        date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date),
        category,
        chips: Array.isArray(data.chips) ? data.chips.map(String).slice(0, 3) : [],
        ...render(content),
      } satisfies Post;
    }),
  );
  return posts.filter((p): p is Post => p !== null);
}

// ---------------------------------------------------------------- reports

const day = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** "28 Sep to 4 Oct 2026" */
export function weekLabel(week: string) {
  const last = new Date(weekEnd(week).getTime() - 86_400_000).toISOString().slice(0, 10);
  return `${day(week, { day: "numeric", month: "short" })} to ${day(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

export const reportSlug = (week: string) => `hiring-this-week-${week}`;

async function reportPost(stats: ReportStats): Promise<Post> {
  let words = "";
  try {
    words = await readFile(join(CONTENT, "reports", `${stats.week}.md`), "utf8");
  } catch {
    // No commentary this week: the numbers stand on their own.
  }
  const share = stats.roles ? Math.round((stats.remote / stats.roles) * 100) : 0;
  const top = stats.topCompanies[0];
  return {
    slug: reportSlug(stats.week),
    title: `Hiring this week: ${weekLabel(stats.week)}`,
    description:
      `${stats.roles.toLocaleString("en-US")} roles from ${stats.companies.toLocaleString("en-US")} companies, ` +
      `${share}% remote, ${stats.openToSriLanka.toLocaleString("en-US")} open to Sri Lanka` +
      (top ? `. ${top.name} posted the most.` : "."),
    date: weekEnd(stats.week).toISOString().slice(0, 10),
    category: "Report",
    chips: [],
    ...render(matter(words).content),
    minutes: 3,
    report: stats,
  };
}

/** Every published post, newest first. */
export async function allPosts(): Promise<Post[]> {
  const [posts, reports] = await Promise.all([readPosts(), finishedReports()]);
  const all = [...posts, ...(await Promise.all(reports.map(reportPost)))];
  return all.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export async function postBySlug(slug: string): Promise<Post | null> {
  return (await allPosts()).find((p) => p.slug === slug) ?? null;
}

export const formatDate = (iso: string) => day(iso, { day: "numeric", month: "long", year: "numeric" });
