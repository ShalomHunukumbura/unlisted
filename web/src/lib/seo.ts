import { unstable_cache } from "next/cache";

import { countryName } from "@/components/Tags";

import { query } from "./db";
import { FRESH, MAX_AGE_DAYS, type Filters, type Job } from "./queries";

/**
 * What search engines see: the site's address, the landing pages, Google for
 * Jobs data on each job page, and what the sitemap lists.
 */

/** The canonical address. SITE_URL wins; Vercel sets the production domain. */
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/** Search pages with any of these in the URL are kept out of the index: thousands of near-duplicates. */
export const SEARCH_PARAMS = ["q", "remote", "country", "region", "company", "department", "since", "exp", "pay", "cursor", "pages"];

// ---------------------------------------------------------------- landing pages

export type Landing = {
  path: string;
  /** The <h1> and the start of the <title>. */
  title: string;
  /** One sentence under the heading; {n} is the number of roles. */
  intro: string;
  filters: Filters;
};

/** Remote work, the filter people come for. */
export const REMOTE_PAGES: Landing[] = [
  {
    path: "/remote",
    title: "Remote jobs",
    intro: "{n} remote roles posted on company career pages in the past week, from anywhere, a region or one country.",
    filters: { remote: "1" },
  },
  {
    path: "/remote/anywhere",
    title: "Remote jobs you can do from anywhere",
    intro: "{n} remote roles from the past week whose posting names no country or region: open worldwide.",
    filters: { remote: "anywhere" },
  },
  {
    path: "/remote/sri-lanka",
    title: "Remote jobs open to Sri Lanka",
    intro:
      "{n} remote roles from the past week you can apply to from Sri Lanka: open worldwide, open to Asia-Pacific, or naming Sri Lanka or India.",
    filters: { remote: "apac" },
  },
];

/**
 * Roles and skills people search for. A quoted phrase matches the job title;
 * a single word matches anywhere in the posting.
 */
const ROLE_PAGES: [slug: string, title: string, q: string][] = [
  ["software-engineer", "Software Engineer", '"software engineer"'],
  ["backend-engineer", "Backend Engineer", "backend"],
  ["frontend-engineer", "Frontend Engineer", "frontend"],
  ["full-stack-engineer", "Full Stack Engineer", "full-stack"],
  ["mobile-engineer", "Mobile Engineer", '"mobile engineer"'],
  ["devops-engineer", "DevOps Engineer", "devops"],
  ["site-reliability-engineer", "Site Reliability Engineer", '"site reliability"'],
  ["security-engineer", "Security Engineer", '"security engineer"'],
  ["data-engineer", "Data Engineer", '"data engineer"'],
  ["data-scientist", "Data Scientist", '"data scientist"'],
  ["data-analyst", "Data Analyst", '"data analyst"'],
  ["machine-learning-engineer", "Machine Learning Engineer", '"machine learning"'],
  ["ai-engineer", "AI Engineer", '"ai engineer"'],
  ["qa-engineer", "QA Engineer", '"qa engineer"'],
  ["engineering-manager", "Engineering Manager", '"engineering manager"'],
  ["product-manager", "Product Manager", '"product manager"'],
  ["product-designer", "Product Designer", '"product designer"'],
  ["ux-designer", "UX Designer", '"ux designer"'],
  ["account-executive", "Account Executive", '"account executive"'],
  ["customer-success-manager", "Customer Success Manager", '"customer success"'],
  ["marketing-manager", "Marketing Manager", '"marketing manager"'],
  ["recruiter", "Recruiter", '"recruiter"'],
  ["python", "Python", "python"],
  ["javascript", "JavaScript", "javascript"],
  ["typescript", "TypeScript", "typescript"],
  ["react", "React", "react"],
  ["java", "Java", "java"],
  ["golang", "Go", "golang"],
  ["rust", "Rust", "rust"],
  ["kubernetes", "Kubernetes", "kubernetes"],
];

export const ROLE_LANDINGS: Landing[] = ROLE_PAGES.map(([slug, name, q]) => ({
  path: `/roles/${slug}`,
  title: `${name} jobs`,
  intro: q.startsWith('"')
    ? `{n} ${name} roles posted on company career pages in the past week, newest first.`
    : `{n} roles from the past week that mention ${name}, straight from company career pages.`,
  filters: { q },
}));

export function roleLanding(slug: string): Landing | undefined {
  return ROLE_LANDINGS.find((l) => l.path === `/roles/${slug}`);
}

/** "United Kingdom" -> "united-kingdom". */
export const countrySlug = (code: string) =>
  countryName(code).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function countryLanding(code: string): Landing {
  const name = countryName(code);
  return {
    path: `/locations/${countrySlug(code)}`,
    title: `Jobs in ${name}`,
    intro: `{n} roles based in ${name} posted on company career pages in the past week, on-site, hybrid and remote.`,
    filters: { country: code },
  };
}

// ---------------------------------------------------------------- data

const DAY = `interval '${MAX_AGE_DAYS} days'`;

/**
 * Countries with open roles, most first: the /locations pages. Ones with
 * fewer than MIN_ROLES get a page (job pages link to it) but stay out of the
 * index: a page with two jobs is thin.
 */
export const MIN_ROLES = 5;
export const countriesWithJobs = unstable_cache(
  () =>
    query<{ country: string; n: number }>(
      `SELECT country, count(*)::int AS n FROM jobs j
        WHERE closed_at IS NULL AND ${FRESH} AND country IS NOT NULL
        GROUP BY country ORDER BY n DESC`,
    ),
  ["seo-countries-v1"],
  { revalidate: 3600 },
);

/** Companies with open roles: the /companies index and pages. */
export const companiesWithJobs = unstable_cache(
  () =>
    query<{ slug: string; name: string; n: number }>(
      `SELECT c.slug, min(c.name) AS name, count(*)::int AS n
         FROM jobs j JOIN companies c ON c.id = j.company_id
        WHERE j.closed_at IS NULL AND ${FRESH}
        GROUP BY c.slug ORDER BY lower(min(c.name))`,
    ),
  ["seo-companies-v1"],
  { revalidate: 3600 },
);

export async function companyBySlug(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const rows = await query<{ name: string; careers_url: string | null }>(
    `SELECT name, careers_url FROM companies WHERE slug = $1 ORDER BY enabled DESC, id LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

/** Every open role (the newest posting of each), for the sitemap. */
export const sitemapJobs = unstable_cache(
  () =>
    query<{ id: string; at: Date }>(
      `SELECT DISTINCT ON (j.company_id, lower(j.title)) j.id::text, COALESCE(j.posted_at, j.first_seen_at) AS at
         FROM jobs j
        WHERE j.closed_at IS NULL AND COALESCE(j.posted_at, j.first_seen_at) > now() - ${DAY}
        ORDER BY j.company_id, lower(j.title), j.posted_at DESC NULLS LAST, j.id DESC`,
    ),
  ["seo-sitemap-jobs-v1"],
  { revalidate: 3600 },
);

// ---------------------------------------------------------------- Google for Jobs

const EMPLOYMENT: Record<string, string> = {
  fulltime: "FULL_TIME",
  "full-time": "FULL_TIME",
  "full time": "FULL_TIME",
  parttime: "PART_TIME",
  "part-time": "PART_TIME",
  "part time": "PART_TIME",
  contract: "CONTRACTOR",
  contractor: "CONTRACTOR",
  intern: "INTERN",
  internship: "INTERN",
  temporary: "TEMPORARY",
};

const UNIT: Record<string, string> = { year: "YEAR", month: "MONTH", hour: "HOUR" };

/**
 * schema.org JobPosting for Google for Jobs
 * (developers.google.com/search/docs/appearance/structured-data/job-posting).
 * Only when the location can be stated truthfully: Google needs a country,
 * and "remote from anywhere" or "remote in EMEA" have none, so those get no
 * markup (the page is still indexed). validThrough is when the role leaves
 * Unlisted, which is also when its page goes.
 */
export function jobPostingData(job: Job & { description_html?: string | null }) {
  if (!job.description_html || job.closed_at) return null;
  const posted = job.posted_at ?? job.first_seen_at;
  if (!posted || !job.country) return null;
  if (job.remote && job.open_to !== "country" && job.open_to !== null) return null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description_html,
    datePosted: posted,
    validThrough: new Date(new Date(posted).getTime() + MAX_AGE_DAYS * 86_400_000).toISOString(),
    hiringOrganization: { "@type": "Organization", name: job.company_name },
    identifier: { "@type": "PropertyValue", name: job.company_name, value: job.id },
    directApply: false,
    url: `${SITE_URL}/jobs/${job.id}`,
  };
  const employment = EMPLOYMENT[(job.employment_type ?? "").toLowerCase()];
  if (employment) data.employmentType = employment;

  if (job.remote) {
    // Fully remote, from one country.
    data.jobLocationType = "TELECOMMUTE";
    data.applicantLocationRequirements = { "@type": "Country", name: countryName(job.country) };
  } else {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.locations[0] && { addressLocality: job.locations[0] }),
        addressCountry: job.country,
      },
    };
  }
  if (job.comp_period && job.comp_min != null) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.comp_currency || "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: Number(job.comp_min),
        ...(job.comp_max != null && { maxValue: Number(job.comp_max) }),
        unitText: UNIT[job.comp_period],
      },
    };
  }
  if (job.exp_min_years != null && job.exp_source !== "title") {
    data.experienceRequirements = {
      "@type": "OccupationalExperienceRequirements",
      monthsOfExperience: job.exp_min_years * 12,
    };
  }
  return data;
}

/** JSON for a <script type="application/ld+json">: no "</script>" can end it early. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
