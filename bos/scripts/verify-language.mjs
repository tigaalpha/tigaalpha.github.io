/* Browser verification of the BOS th/en language system:
   - login page: EN toggle button appears top-right, clicking swaps the card
     subtitle + button copy to Thai, persists via localStorage after reload
   - login page: clicking TH toggles back to Thai-first default
   The workspace pages need a Supabase session, which this headless run has no
   credentials for — the shell (sidebar/topbar) strings all flow through the
   same useLang()+translate() path exercised here, so the login check covers
   the provider wiring end to end. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/node_modules/playwright-core");

const ROOT = new URL("../out/", import.meta.url).pathname;
const PORT = 4173;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    // strip the test mount prefix AND the Next basePath (/studio) — out/ files sit at the root
    let path = decodeURIComponent(url.pathname).replace(/^\/(bos-lang|studio)\//, "/");
    let file = path.endsWith("/") ? path + "index.html" : path;
    if (file === "/index.html") file = "/index.html"; // root redirect target
    let full = normalize(join(ROOT, file));
    if (!full.startsWith(normalize(ROOT))) throw new Error("traversal");
    let body = await readFile(full);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${ROOT} on :${PORT}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ── login page ──────────────────────────────────────────────────────────────
await page.goto(`http://localhost:${PORT}/login/`, { waitUntil: "networkidle" });

const toggle = page.locator("header button, main > div > div button", { hasText: /^EN$|^TH$/ }).first();
// the login page puts the toggle in an absolute top-right div, not a header
const toggleBtn = page.getByRole("button", { name: /Switch to English|สลับเป็นภาษาไทย/ }).first();
await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });

const box = await toggleBtn.boundingBox();
const vp = page.viewportSize();
check("toggle is in the top-right corner", !!box && box.y < 120 && box.x > vp.width * 0.6, JSON.stringify(box));

check("default copy is Thai (no stored preference)", await page.getByText("ลงชื่อเข้าใช้เพื่อจัดการสตูดิโอของคุณ").isVisible());

await toggleBtn.click();
check("switched to English: subtitle", await page.getByText("Sign in to manage your studio").isVisible());
check("switched to English: button", await page.getByRole("button", { name: "Continue with Google" }).isVisible());
check("html[lang] updated", (await page.getAttribute("html", "lang")) === "en");

await page.reload({ waitUntil: "networkidle" });
check("English persists after reload", await page.getByText("Sign in to manage your studio").isVisible());

await page.getByRole("button", { name: /สลับเป็นภาษาไทย/ }).first().click();
check("toggled back to Thai", await page.getByText("ลงชื่อเข้าใช้เพื่อจัดการสตูดิโอของคุณ").isVisible());

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
