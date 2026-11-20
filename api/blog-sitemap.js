// Fresh list of the published articles of ONE language: /sitemap-blog-<lang>.xml (th en zh ja ko ru hi es fr ar de), which vercel.json rewrites to /api/blog-sitemap?lang=<lang>.
// It is ten files and not one because a Vercel Function may not answer more than about 4.5 MB (why: see the comment above SITEMAP_MAX_URLS in scripts/blog-paths.mjs). The root sitemap.xml is still produced at build time
// and names the ten files directly; this function is the one that can name an article published after that build. /sitemap-blog.xml is a 301 to /sitemap.xml (vercel.json); no ?lang= answers the ten-file index, an unknown one a 404.
import { serveBlogSitemapQuery, writeNode } from "../scripts/blog-live.mjs";

export default async function handler(req, res) {
  const out = await serveBlogSitemapQuery(req.query || {}, fetch);
  writeNode(res, out);
}
