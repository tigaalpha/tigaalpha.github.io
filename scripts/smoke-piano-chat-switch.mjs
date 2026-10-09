// Drives the REAL supabase/functions/piano-chat/index.ts (transpiled, Deno stubbed, fetch faked) and checks the automatic model
// switch: Nemotron limited -> Gemini 2.5 Flash, Nemotron back -> first again, autoSwitch:false -> old behaviour.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { transformSync } = require("esbuild");
const src = readFileSync(new URL("../supabase/functions/piano-chat/index.ts", import.meta.url), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };

async function load(settingsEntry) {
  const env = { OPENROUTER_API_KEY: "or", GEMINI_API_KEY: "gm", SUPABASE_URL: "http://sb", SUPABASE_ANON_KEY: "anon" };
  const calls = []; let nemoLimited = true;
  const sse = (t) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }], candidates: [{ content: { parts: [{ text: t }] } }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.includes("/rest/v1/app_settings")) return new Response(JSON.stringify([{ key: "ai_models", value: { chat: settingsEntry } }]), { status: 200 });
    if (url.includes("openrouter.ai")) {
      const model = JSON.parse(init.body).model; calls.push("or:" + model);
      if (model.includes("nemotron-3-super") && nemoLimited) return new Response('{"error":{"code":429,"message":"rate limit"}}', { status: 429 });
      if (model.includes("nex-agi")) return new Response('{"error":{"message":"This model is unavailable for free"}}', { status: 404 });
      return sse("from-" + model);
    }
    if (url.includes("generativelanguage")) { calls.push("gemini"); return sse("from-gemini"); }
    throw new Error("unexpected " + url);
  };
  await import("data:text/javascript;base64," + Buffer.from(js + "\n// " + Math.random()).toString("base64"));
  const ask = async () => {
    calls.length = 0;
    const r = await globalThis.__h(new Request("http://x", { method: "POST", headers: { authorization: "Bearer u" }, body: JSON.stringify({ message: "hi", conversationHistory: [], system: "s", feature: "chat", stream: true }) }));
    const t = await r.text();
    return { text: t, calls: [...calls] };
  };
  return { ask, setLimited: (v) => { nemoLimited = v; } };
}
const nemo = { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" };

{
  const m = await load(nemo);
  const a = await m.ask();
  check("limited Nemotron -> Gemini answers", /from-gemini/.test(a.text) && a.calls[0].includes("nemotron-3-super") && a.calls.includes("gemini"), a.calls.join(","));
  const b = await m.ask();
  check("while it cools the next question skips Nemotron", b.calls[0] === "gemini" && !b.calls.some((c) => c.includes("nemotron-3-super")), b.calls.join(","));
  m.setLimited(false);
  // cooldown is 90s; fast-forward the clock
  const realNow = Date.now; Date.now = () => realNow() + 120_000;
  const c = await m.ask();
  Date.now = realNow;
  check("after the cooldown Nemotron is first again and answers", c.calls[0].includes("nemotron-3-super") && /from-nvidia/.test(c.text), c.calls.join(","));
}
{
  const m = await load({ ...nemo, autoSwitch: false });
  const a = await m.ask();
  check("autoSwitch:false -> Gemini is not used", !a.calls.includes("gemini") && !/from-gemini/.test(a.text), a.calls.join(","));
}
{
  const m = await load({ provider: "gemini", model: "gemini-2.5-flash" });
  const a = await m.ask();
  check("manual Gemini primary still works", a.calls[0] === "gemini" && /from-gemini/.test(a.text), a.calls.join(","));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
