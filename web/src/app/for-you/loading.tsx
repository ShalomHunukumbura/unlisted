import { SkeletonPage } from "@/components/Skeleton";

/**
 * Ranking every open role takes a moment. Only here: a loading.tsx makes a
 * page stream with status 200 before it renders, so a page that can 404 (a
 * job, a company, a blog post) must not sit under one. For you never does.
 */
export default function Loading() {
  return <SkeletonPage />;
}
