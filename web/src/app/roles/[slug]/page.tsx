import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LandingPage from "@/components/LandingPage";
import { countRoles } from "@/lib/queries";
import { REMOTE_PAGES, ROLE_LANDINGS, roleLanding } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/roles/[slug]">): Promise<Metadata> {
  const landing = roleLanding((await props.params).slug);
  if (!landing) return {};
  const total = await countRoles(landing.filters);
  return {
    title: landing.title,
    description: landing.intro.replace("{n}", total.toLocaleString("en-US")),
    alternates: { canonical: landing.path },
  };
}

export default async function Role(props: PageProps<"/roles/[slug]">) {
  const landing = roleLanding((await props.params).slug);
  if (!landing) notFound();
  const related = [
    // Remote versions of the same search, then other roles.
    ...REMOTE_PAGES.map((p) => ({ href: p.path, label: p.title })),
    ...ROLE_LANDINGS.filter((p) => p !== landing).map((p) => ({ href: p.path, label: p.title })),
  ];
  return <LandingPage landing={landing} related={related} />;
}
