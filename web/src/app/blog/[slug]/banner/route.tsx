import { postBySlug } from "@/lib/blog";
import { banner } from "@/lib/banner";

/** /blog/<slug>/banner: the post's banner image (and its share preview). */
export async function GET(_request: Request, ctx: RouteContext<"/blog/[slug]/banner">) {
  const post = await postBySlug((await ctx.params).slug);
  if (!post) return new Response("Not found", { status: 404 });
  return banner(post);
}
