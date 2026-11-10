import { redirectTarget } from "./scripts/edge-redirect.mjs";

export default function middleware(request) {
  const path = new URL(request.url).pathname;
  if (path === "/indexnow-key.txt") {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
  }
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  const to = redirectTarget(request.url, host, proto);
  if (to) return Response.redirect(to, 301);
}

export const config = { matcher: "/:path*" };
