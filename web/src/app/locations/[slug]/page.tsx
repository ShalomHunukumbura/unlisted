import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LandingPage from "@/components/LandingPage";
import { countRoles } from "@/lib/queries";
import { MIN_ROLES, REMOTE_PAGES, countriesWithJobs, countryLanding, countrySlug } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function find(slug: string) {
  const countries = await countriesWithJobs();
  return countries.find((c) => countrySlug(c.country) === slug) ?? null;
}

export async function generateMetadata(props: PageProps<"/locations/[slug]">): Promise<Metadata> {
  const country = await find((await props.params).slug);
  if (!country) return {};
  const landing = countryLanding(country.country);
  const total = await countRoles(landing.filters);
  return {
    title: landing.title,
    description: landing.intro.replace("{n}", total.toLocaleString("en-US")),
    alternates: { canonical: landing.path },
    ...(country.n < MIN_ROLES && { robots: { index: false } }),
  };
}

export default async function Location(props: PageProps<"/locations/[slug]">) {
  const country = await find((await props.params).slug);
  if (!country) notFound();
  const others = (await countriesWithJobs()).filter((c) => c.country !== country.country && c.n >= MIN_ROLES);
  const related = [
    ...REMOTE_PAGES.map((p) => ({ href: p.path, label: p.title })),
    ...others.slice(0, 20).map((c) => ({ href: countryLanding(c.country).path, label: countryLanding(c.country).title })),
  ];
  return <LandingPage landing={countryLanding(country.country)} related={related} />;
}
