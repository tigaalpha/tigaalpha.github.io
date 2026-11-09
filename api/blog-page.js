// Missing static blog files are rendered here from published rows. A file that
// already exists is served by Vercel before this rewrite, so older pages stay
// the files the last build wrote. This function does not insert or update posts.
import { serveBlog, writeNode } from "../scripts/blog-live.mjs";

export default async function handler(req, res) {
  const out = await serveBlog(req.query || {}, fetch);
  writeNode(res, out);
}
