import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LandingPage from "@/components/LandingPage";
import { countRoles } from "@/lib/queries";
import { REMOTE_PAGES, ROLE_LANDINGS } from "@/lib/seo";

export const dynamic = "force-dynamic";

function pageFor(slug?: string[]) {
  const path = `/remote${slug?.length ? `/${slug.join("/")}` : ""}`;
  return REMOTE_PAGES.find((p) => p.path === path);
}

export async function generateMetadata(props: PageProps<"/remote/[[...slug]]">): Promise<Metadata> {
  const landing = pageFor((await props.params).slug);
  if (!landing) return {};
  const total = await countRoles(landing.filters);
  return {
    title: landing.title,
    description: landing.intro.replace("{n}", total.toLocaleString("en-US")),
    alternates: { canonical: landing.path },
  };
}

export default async function Remote(props: PageProps<"/remote/[[...slug]]">) {
  const landing = pageFor((await props.params).slug);
  if (!landing) notFound();
  const related = [
    ...REMOTE_PAGES.filter((p) => p !== landing).map((p) => ({ href: p.path, label: p.title })),
    ...ROLE_LANDINGS.slice(0, 8).map((p) => ({ href: p.path, label: p.title })),
  ];
  return <LandingPage landing={landing} related={related} />;
}
