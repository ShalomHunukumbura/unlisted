import { unsubscribe } from "@/lib/alerts";

// One-click unsubscribe from the email client's own button (RFC 8058): a POST
// to the List-Unsubscribe address. The link in the email body goes to a page
// with a button instead, since link scanners open every URL in an email.
export async function POST(_req: Request, ctx: RouteContext<"/api/alerts/unsubscribe/[token]">) {
  await unsubscribe((await ctx.params).token);
  return new Response(null, { status: 204 });
}
