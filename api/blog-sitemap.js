// Fresh list of published articles. The big sitemap.xml is still produced at
// build time; this file is the one that can name an article published after that build.
import { serveBlogSitemap, writeNode } from "../scripts/blog-live.mjs";

export default async function handler(req, res) {
  const out = await serveBlogSitemap(fetch);
  writeNode(res, out);
}
