import { redirectTarget } from "./scripts/edge-redirect.mjs";

export default function middleware(request) {
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  const to = redirectTarget(request.url, host, proto);
  if (to) return Response.redirect(to, 301);
}

export const config = { matcher: "/:path*" };
