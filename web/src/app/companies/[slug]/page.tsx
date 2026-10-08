import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LandingPage from "@/components/LandingPage";
import { countRoles } from "@/lib/queries";
import { REMOTE_PAGES, companyBySlug, type Landing } from "@/lib/seo";

export const dynamic = "force-dynamic";

function landingFor(slug: string, name: string): Landing {
  return {
    path: `/companies/${slug}`,
    title: `${name} jobs`,
    intro: `{n} open roles at ${name}, straight from its careers page, posted in the past week.`,
    filters: { companySlug: slug },
  };
}

export async function generateMetadata(props: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const company = await companyBySlug(slug);
  if (!company) return {};
  const landing = landingFor(slug, company.name);
  const total = await countRoles(landing.filters);
  return {
    title: `${company.name} jobs and careers`,
    description: landing.intro.replace("{n}", total.toLocaleString("en-US")),
    alternates: { canonical: landing.path },
    // No open roles this week: reachable, but nothing worth indexing.
    ...(total === 0 && { robots: { index: false } }),
  };
}

export default async function Company(props: PageProps<"/companies/[slug]">) {
  const { slug } = await props.params;
  const company = await companyBySlug(slug);
  if (!company) notFound();
  return (
    <LandingPage
      landing={landingFor(slug, company.name)}
      related={[{ href: "/companies", label: "All companies" }, ...REMOTE_PAGES.map((p) => ({ href: p.path, label: p.title }))]}
    />
  );
}
