// Paths that are not the app. A missing file must not fall through to index.html.
export default function handler(req, res) {
  res.statusCode = 404;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("x-robots-tag", "noindex");
  res.setHeader("cache-control", "no-store");
  res.end("Not found\n");
}
