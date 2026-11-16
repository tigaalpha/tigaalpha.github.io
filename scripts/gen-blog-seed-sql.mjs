#!/usr/bin/env node
/* gen-blog-seed-sql.mjs — writes the blog DATABASE migrations from the committed article sources (blog-src/<lang>/<slug>.json). Two sets, generated separately:

   ja / ko / ru  (the migration applied on 2026-11-13: the articles are inline in the SQL; its output must never change, so every language list below is FIXED, not read from STATIC_LANGS)
     node scripts/gen-blog-seed-sql.mjs            write supabase-blog-ja-ko-ru-migration.sql
     node scripts/gen-blog-seed-sql.mjs --check    exit 1 when the file is missing or stale (does not write)
     node scripts/gen-blog-seed-sql.mjs --json     write only supabase-blog-ja-ko-ru-migration-rows.json
   The migration has two parts: (1) the language check of public.blog_posts is widened to th en zh ja ko ru, (2) every source article is inserted (published) with ON CONFLICT DO NOTHING,
   so a row the admin already wrote in the app is never overwritten. The file is WRITTEN, NOT APPLIED: the owner runs it. Reading the sources goes through the same readStaticPosts() the page
   generator uses, so a malformed file is skipped the same way in both. The output depends only on blog-src (no dates, no randomness), so --check is a plain byte comparison.

   hi / es / fr / ar  (owner, 2026-11-13; the database is told to FETCH the articles instead of carrying them: they are too big to paste)
     node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar            write supabase-blog-hi-es-fr-ar-migration.sql (placeholder __PINNED_SHA__, committed) AND supabase-blog-hi-es-fr-ar-migration-rows.json
     node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --check    exit 1 when either file is missing or stale, or when lang-extra.ts lists a language the migration does not
     node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --json     write only the rows file
     node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --sha <40 hex> --out <file.sql> [--no-git-check]
                                                                   the RELEASE copy: the same SQL with the real commit in place of the placeholder (env BLOG_SEED_SHA does the same as --sha).
                                                                   Written to --out (or BLOG_SEED_OUT) only, never over the committed file; BLOG_SEED_SHA is read only when an output path is given too. The commit must hold the rows file: git is asked for it and its md5 must be
                                                                   the md5 of the rows produced from blog-src now (--no-git-check skips that question; the database still refuses any other md5).
                                                                   The commit must also be on github.com (pushed): the database fetches it from raw.githubusercontent.com. If scripts/apply-sql.mjs will send a part, name the file
                                                                   supabase-<anything>.sql (the only name that script accepts) and send PART A and PART B as two files: it sends one file as ONE execution, and the whole copy stops at PART B.
     ... --part a|b                                                prints (or writes to --out) only PART A or PART B of that copy, ready to be sent as one execution each
   The SQL: PART A widens the language checks and the two functions that carry a language list (bodies copied from supabase-blog-views-migration.sql, only the list changed) and queues one pg_net fetch
   of the rows file at the pinned commit; PART B finds the answer by its md5, checks it and inserts with ON CONFLICT (lang, slug) DO NOTHING in the same statement (pg_net sends a request only after the
   transaction that queued it has committed, so the two cannot be one execution). md5, row count, byte size and the per-language counts in the SQL are read from the rows text generated here.
   BLOG_SRC (a temp blog-src for tests) and BLOG_SEED_OUT (the SQL path; the rows file sits next to it as <name>-rows.json) work for both sets, like before. */
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { readStaticPosts, STATIC_LANGS } from "./build-blog-pages.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.resolve(process.env.BLOG_SRC || path.join(ROOT, "blog-src"));   // the same folder readStaticPosts() reads
const REPO = "tigaalpha/tigaalpha.github.io", PLACEHOLDER = "__PINNED_SHA__";            // the public repo the database fetches from, and the text the committed copy carries instead of a commit
const SETS = {
  "ja-ko-ru": { langs: ["ja", "ko", "ru"], sql: "supabase-blog-ja-ko-ru-migration.sql" },
  "hi-es-fr-ar": { langs: ["hi", "es", "fr", "ar"], sql: "supabase-blog-hi-es-fr-ar-migration.sql" },
};
const SIX = ["th", "en", "zh", "ja", "ko", "ru"], TEN = [...SIX, "hi", "es", "fr", "ar"];   // the languages the database allowed before this work / allows after it (keep TEN in step with ALL_LANGS in lang-extra.ts)
const list = (a) => "(" + a.map(l => `'${l}'`).join(",") + ")";                            // ('th','en',...) as the SQL files write it
const ROWS_OF = (sqlPath) => sqlPath.replace(/\.sql$/, "") + "-rows.json";                  // supabase-blog-x-migration.sql -> supabase-blog-x-migration-rows.json
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const die = (msg, code = 1) => { console.error("gen-blog-seed-sql: " + msg); process.exit(code); };
const argv = process.argv.slice(2), opt = {}, flag = new Set();
for (let i = 0; i < argv.length; i++) {
  let a = argv[i], v = null; const eq = a.startsWith("--") ? a.indexOf("=") : -1;
  if (eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
  if (["--set", "--sha", "--out", "--part"].includes(a)) { if (v == null) v = argv[++i]; if (v == null || v.startsWith("--")) die(`${a} needs a value (see the top of scripts/gen-blog-seed-sql.mjs)`, 2); opt[a] = v; }
  else if (["--check", "--json", "--no-git-check", "--help", "-h"].includes(a) && v == null) flag.add(a);
  else die(`unknown option "${argv[i]}" (see the top of scripts/gen-blog-seed-sql.mjs)`, 2);
}
if (flag.has("--help") || flag.has("-h")) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\* /, "")); process.exit(0); }
const setName = opt["--set"] || "ja-ko-ru"; if (!SETS[setName]) die(`unknown set "${setName}" (ja-ko-ru or hi-es-fr-ar)`, 2);
const SET = SETS[setName], DEFAULT_SQL = path.join(ROOT, SET.sql);
const OUT_GIVEN = opt["--out"] || process.env.BLOG_SEED_OUT || "", OUT = OUT_GIVEN ? path.resolve(OUT_GIVEN) : DEFAULT_SQL;
// the commit comes from --sha, or from BLOG_SEED_SHA, which counts only together with an explicit output path (a stray variable must not turn a --check of the committed copy into a release copy) and never for ja / ko / ru
const sha = opt["--sha"] || (OUT_GIVEN && setName !== "ja-ko-ru" ? process.env.BLOG_SEED_SHA || "" : "");
if (setName === "ja-ko-ru" && (opt["--sha"] || opt["--part"] || flag.has("--no-git-check"))) die("--sha, --part and --no-git-check belong to --set hi-es-fr-ar", 2);
if (sha && !/^[0-9a-f]{40}$/.test(sha)) die(`"${sha}" is not a full 40-character lowercase commit id (git rev-parse HEAD)`, 2);
if (opt["--part"] && !/^[ab]$/i.test(opt["--part"])) die("--part is a or b", 2);
if (opt["--part"] && (flag.has("--check") || flag.has("--json"))) die("--part cannot be combined with --check or --json", 2);
if (sha && !OUT_GIVEN && !opt["--part"]) die("a release copy needs its own output file: add --out <file.sql> (the committed copy keeps the placeholder " + PLACEHOLDER + ")", 2);
if ((sha || opt["--part"]) && (opt["--part"] ? OUT_GIVEN : true) && path.resolve(OUT) === DEFAULT_SQL) die("refusing to write a release copy or a part over the committed " + SET.sql + " (it must stay whole, with the placeholder " + PLACEHOLDER + "); choose another --out", 2);

/* the articles of one set, in the set's language order, then by slug (readStaticPosts() reads every source-file language; the set keeps its own) */
const postsOf = (langs) => readStaticPosts().filter(p => langs.includes(p.lang)).sort((a, b) => langs.indexOf(a.lang) - langs.indexOf(b.lang) || cmp(a.slug, b.slug));
/* the same rows as one JSON array: the shape a row has in public.blog_posts (id and author_id are left to their defaults) */
const rowsOf = (posts) => posts.map(p => ({ lang: p.lang, slug: p.slug, title: p.title, excerpt: p.excerpt || "", body: p.body, category: p.category, cover_url: p.cover_url || null, published: true, created_at: p.created_at, updated_at: p.updated_at || p.created_at }));
const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch (e) { return null; } };
const compare = (label, file, want) => { const cur = read(file); const state = cur === want ? "current" : cur == null ? "missing" : "stale"; return { label, file, state }; };

/* ============================== ja / ko / ru: articles inline in the SQL (unchanged) ============================== */
function inlineSql(posts, langs) {
  let n = 0;
  // a dollar-quoted string with a tag of its own, bumped until the tag does not occur in the text: quotes, backslashes and "$" in an article are all safe
  const dq = (v) => { let k; do { k = ++n; } while (String(v).includes("$b" + k)); const tag = "$b" + k + "$"; return tag + String(v) + tag; };   // "$b<k>" (not only the whole tag) must be absent: text ending in "$b1" would otherwise close the string early
  const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";   // lang, slug, category and the dates are validated by readStaticPosts; this is only a second belt
  const per = langs.map(l => `${l} ${posts.filter(p => p.lang === l).length}`).join(", ");
  const out = [];
  out.push(`-- Blog in Japanese, Korean and Russian (owner, 2026-11-11): lets public.blog_posts hold ja / ko / ru articles and seeds the ones committed under blog-src/.
-- WRITTEN, NOT APPLIED: needs the owner's approval; run it in the Supabase SQL editor. Generated by scripts/gen-blog-seed-sql.mjs from blog-src/ — regenerate, do not edit by hand
-- (node scripts/gen-blog-seed-sql.mjs --check fails when this file is stale).
--
-- What it changes:
--   0. First statement, before anything else: create table if not exists public.blog_posts_backup_20261113 as table public.blog_posts.
--      A full copy of the live table, so this file can be undone. A second run does not replace that backup.
--   1. public.blog_posts: the language check blog_posts_lang_check allowed only ('th','en','zh'); it now allows ('th','en','zh','ja','ko','ru'). Existing rows are untouched and all satisfy it.
--   2. Inserts the ${posts.length} source articles (${per}) as PUBLISHED rows. "on conflict (lang, slug) do nothing": a row that already exists, e.g. one the admin wrote in the app, is never overwritten,
--      and running this file again changes nothing.
--
-- Not needed for the static pages: /blog/ja|ko|ru/ are built from blog-src/ and work without this file. It is needed for (a) the in-app blog list and the admin screen to show and edit these
-- articles, (b) the admin to write new ja / ko / ru articles in the app, and (c) the reader counter: public.blog_hit() only counts an article that has a published row here (see also
-- supabase-blog-views-migration.sql, which allows the same six languages).
--
-- After applying, check (read-only):
--   select lang, count(*) from public.blog_posts group by lang order by lang;     -- ja / ko / ru appear with the counts above (plus any rows already there)
--   select lang, slug, published from public.blog_posts where lang in ('ja','ko','ru') order by lang, slug;

create table if not exists public.blog_posts_backup_20261113 as table public.blog_posts;

alter table public.blog_posts drop constraint if exists blog_posts_lang_check;
alter table public.blog_posts add constraint blog_posts_lang_check check (lang in ('th','en','zh','ja','ko','ru'));
`);
  for (const p of posts) {
    const cols = ["lang", "slug", "title", "excerpt", "body", "category"], vals = [q(p.lang), q(p.slug), dq(p.title), dq(p.excerpt || ""), dq(p.body), q(p.category)];
    if (p.cover_url) { cols.push("cover_url"); vals.push(dq(p.cover_url)); }
    cols.push("published", "created_at", "updated_at"); vals.push("true", q(p.created_at) + "::timestamptz", q(p.updated_at || p.created_at) + "::timestamptz");
    out.push(`-- ${p.lang}/${p.slug}\ninsert into public.blog_posts (${cols.join(", ")})\nvalues (${vals.join(", ")})\non conflict (lang, slug) do nothing;\n`);
  }
  return { sql: out.join("\n"), per };
}

/* ============================== hi / es / fr / ar: the database fetches the rows file ============================== */
/* the two functions that carry a language list in their body, copied from the reader-counter migration with ONLY that list changed (so grants, security definer and search_path stay the originals) */
function viewsFunction(src, name) {
  const start = src.indexOf(`create or replace function public.${name}(`);
  if (start < 0) die(`supabase-blog-views-migration.sql has no "create or replace function public.${name}("`);
  const g = new RegExp(`^grant execute on function public\\.${name}\\([^\\n]*\\n`, "m").exec(src.slice(start));
  if (!g) die(`supabase-blog-views-migration.sql: no "grant execute on function public.${name}(" line after the function`);
  const block = src.slice(start, start + g.index + g[0].length), parts = block.split(list(SIX));
  if (parts.length !== 2) die(`public.${name} in supabase-blog-views-migration.sql holds the six-language list ${parts.length - 1} times, expected exactly once (was the file changed? then update this generator)`);
  return parts.join(list(TEN));
}
/* problems the table or jsonb would only report at insert time: a NUL or a lone surrogate cannot be stored, a title or body cannot be empty, a (lang, slug) cannot repeat */
function rowProblems(rows, langs) {
  const bad = [], seen = new Set(), lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  for (const r of rows) {
    const id = r.lang + "/" + r.slug;
    if (seen.has(id)) bad.push(id + " appears twice"); seen.add(id);
    if (!langs.includes(r.lang)) bad.push(id + " is not in " + langs.join("/"));
    if (!r.title || !r.body) bad.push(id + " has an empty title or body");
    if (r.published !== true) bad.push(id + " is not published");
    for (const k of ["slug", "title", "excerpt", "body", "category", "cover_url", "created_at", "updated_at"]) { const v = r[k]; if (typeof v === "string" && (v.includes("\u0000") || lone.test(v))) bad.push(`${id}: ${k} holds a NUL or a lone surrogate, which jsonb cannot store`); }
  }
  return bad;
}
/* a malformed source file is skipped by readStaticPosts (with a warning); for a seed that would silently drop an article, so the file count must match */
function skippedSources(posts, langs) {
  const bad = [];
  for (const l of langs) {
    let files = []; try { files = fs.readdirSync(path.join(SRC_DIR, l)).filter(f => f.endsWith(".json")); } catch (e) {}
    let want = 0; for (const f of files) { try { const j = JSON.parse(fs.readFileSync(path.join(SRC_DIR, l, f), "utf8")); if (!j || j.published !== false) want++; } catch (e) { want++; } }
    const have = posts.filter(p => p.lang === l).length;
    if (!have) bad.push(`blog-src/${l}/ gives no article`);
    else if (have !== want) bad.push(`blog-src/${l}/: ${want - have} of ${want} published source files were skipped by readStaticPosts (see its warnings above)`);
  }
  return bad;
}
const registryLangs = () => { const m = /export const ALL_LANGS = \[([^\]]*)\]/.exec(read(path.join(ROOT, "lang-extra.ts")) || ""); return m ? [...m[1].matchAll(/"([a-z]{2,3})"/g)].map(x => x[1]) : null; };
/* the bytes of a file as the pinned commit has them, or null when git cannot say (unknown commit, file not in it) */
const blobAt = (commit, rel) => { try { return execFileSync("git", ["-C", ROOT, "cat-file", "blob", `${commit}:${rel}`], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return null; } };

function fetchSql({ posts, langs, rowsText, pinned }) {
  const rows = JSON.parse(rowsText), md5 = crypto.createHash("md5").update(rowsText, "utf8").digest("hex"), bytes = Buffer.byteLength(rowsText, "utf8");
  // the same digest the database computes over the seeded rows (lang, slug, title, excerpt, body; ordered by lang, slug in byte order: lang and slug are plain ASCII, so "<" is the "C" collation)
  const digest = crypto.createHash("md5").update([...rows].sort((a, b) => cmp(a.lang, b.lang) || cmp(a.slug, b.slug)).map(r => [r.lang, r.slug, r.title, r.excerpt, r.body].join("\u0001")).join("\u0002"), "utf8").digest("hex");
  const per = langs.map(l => `${l} ${rows.filter(r => r.lang === l).length}`).join(", "), rowsFile = path.basename(ROWS_OF(DEFAULT_SQL)), url = `https://raw.githubusercontent.com/${REPO}/`;
  const sin = pinned || PLACEHOLDER, lt = list(langs), tenL = list(TEN), sixL = list(SIX), views = read(path.join(ROOT, "supabase-blog-views-migration.sql"));
  if (views == null) die("supabase-blog-views-migration.sql is missing (the two functions are copied from it)");
  const hit = viewsFunction(views, "blog_hit"), counts = viewsFunction(views, "blog_view_counts");
  const header = `-- Blog in Hindi, Spanish, French and Arabic (owner, 2026-11-13): lets public.blog_posts and the blog reader counter hold hi / es / fr / ar articles, and seeds the ${rows.length} articles committed under blog-src/.
-- WRITTEN, NOT APPLIED: needs the owner's approval; run it in the Supabase SQL editor or through the connector, in the two parts below. Generated by scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar from blog-src/ — regenerate, do not edit by hand
-- (node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --check fails when this file or ${rowsFile} is stale).
--
-- Needs supabase-blog-views-migration.sql applied first (it was, 2026-11-13; PART A stops with a clear message if it is not) and the pg_net extension (the ja / ko / ru seed was fetched with it on 2026-11-13).
-- ORDER MATTERS: supabase-blog-views-migration.sql and supabase-blog-ja-ko-ru-migration.sql still write the six-language list. Never run either of them AFTER this file: it would stop on the first hi / es / fr / ar row
-- or, with none, narrow the checks and the two functions back to six; if one ever has to be re-run, run PART A of this file again afterwards.
-- ${pinned ? `RELEASE COPY. Pinned commit: ${pinned}. The database fetches ${url}${pinned}/${rowsFile}` : `THIS COMMITTED COPY HAS THE PLACEHOLDER ${PLACEHOLDER} AND PART A REFUSES IT. The release copy replaces it with the commit that holds ${rowsFile}:
--   node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --sha <that commit, 40 hex> --out <release.sql>      (the generator asks git whether the commit holds exactly these rows)`}
--
-- RUN IT IN TWO PARTS, each as ONE execution, with a pause between them. pg_net sends a request only after the transaction that queued it has committed, so the fetch and the insert cannot be one run:
--   PART A  the schema changes, then it queues the fetch of ${rowsFile}. It inserts no article.
--           (wait 10-20 seconds)
--   PART B  finds the fetched file by its md5, checks it and inserts the rows, all in the same statement.
-- Both parts can be run again at any time; a second run changes nothing in the blog tables, except that PART B inserts again an article that was deleted since (in the admin screen, say). Sent as ONE execution the whole file stops at PART B ("has not arrived") and is rolled back, so nothing is lost either way.
-- "node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --sha <commit> --part a" (or b) prints one part.
--
-- What it changes:
--   A.1 Copies public.blog_posts as it is now into public.blog_posts_backup_hi_es_fr_ar (the first copy is kept on a second run) so the file can be undone, and locks that copy (a copy made by "create table as" has no
--       row-level security and Supabase normally hands new public tables to the public key; the 2026-11-13 backup of the ja / ko / ru migration is locked the same way, if it exists).
--   A.2 The language checks blog_posts_lang_check, blog_hits_lang_check and blog_view_totals_lang_check allowed ${sixL}; they now allow ${tenL}. Existing rows all satisfy them.
--   A.3 public.blog_hit() and public.blog_view_counts() repeat the language list inside their body; both are replaced with the same body and the ten languages (copied from supabase-blog-views-migration.sql by the
--       generator, only the list changed). Grants and security settings are the originals: security definer, search_path '', execute for anon and authenticated only.
--       public.blog_stats() and public.blog_purge() carry no language list and are not touched.
--   A.4 Queues one fetch (pg_net) of ${rowsFile} from github.com/${REPO} at the pinned commit.
--   B   Inserts the ${rows.length} source articles (${per}) as PUBLISHED rows, but only from a fetched body whose md5 is ${md5} (${bytes} bytes) and that holds exactly ${rows.length} rows. "on conflict (lang, slug) do nothing": a row that
--       already exists, e.g. one the admin wrote or edited in the app, is never overwritten, and running PART B again changes nothing (only an article deleted in the meantime is inserted again).
--
-- Not needed for the static pages: /blog/hi|es|fr|ar/ are built from blog-src/ and work without this file. It is needed for (a) the in-app blog list and the admin screen to show and edit these articles,
-- (b) the admin to write new hi / es / fr / ar articles in the app, and (c) the reader counter: public.blog_hit() only counts an article that has a published row here, and refuses a language outside its list.
-- Arabic is right-to-left only on screen; it is stored as plain UTF-8 like every other language.
`;
  const partA = `-- ====================================================================================================================================================================================
-- PART A of 2 — run first, as ONE execution. Schema changes, then the fetch of the rows file is queued. Safe to run again.
-- ====================================================================================================================================================================================

-- A.0  Stops before anything is changed when the reader-counter migration is missing (this file widens objects that file creates), when pg_net is not there, or when this copy has no pinned commit.
do $pre$
declare v_sha constant text := '${sin}';
begin
  if to_regclass('public.blog_posts') is null or to_regclass('public.blog_hits') is null or to_regclass('public.blog_view_totals') is null or to_regclass('public.blog_day_budget') is null
     or to_regprocedure('public.blog_hit(text,text,text,text)') is null or to_regprocedure('public.blog_view_counts(text)') is null then
    raise exception 'hi/es/fr/ar blog migration: apply supabase-blog-views-migration.sql first (a blog table or function it creates is missing)';
  end if;
  if to_regclass('net._http_response') is null or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'net' and p.proname = 'http_get') then
    raise exception 'hi/es/fr/ar blog migration: the pg_net extension is not enabled (Database > Extensions); PART A fetches the rows file with it';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'hi/es/fr/ar blog migration: this copy has no pinned commit (found %). Make the release copy: node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar --sha <commit that holds ${rowsFile}> --out <file.sql>', v_sha;
  end if;
end
$pre$;

-- A.1  A copy of the table as it is now. "create table as" copies no row-level security and Supabase normally hands new public tables to the public key, so the copy is locked at once (no policy on purpose: only the table owner and the service role can read it).
create table if not exists public.blog_posts_backup_hi_es_fr_ar as table public.blog_posts;
alter table public.blog_posts_backup_hi_es_fr_ar enable row level security;
revoke all on public.blog_posts_backup_hi_es_fr_ar from anon, authenticated;
do $lock$
begin
  if to_regclass('public.blog_posts_backup_20261113') is not null then   -- the backup of the ja / ko / ru migration, made the same way and left open
    begin
      execute 'alter table public.blog_posts_backup_20261113 enable row level security';
      execute 'revoke all on public.blog_posts_backup_20261113 from anon, authenticated';
    exception when insufficient_privilege then
      raise warning 'hi/es/fr/ar blog migration: could not lock public.blog_posts_backup_20261113 (not its owner); lock it by hand: alter table public.blog_posts_backup_20261113 enable row level security';
    end;
  end if;
end
$lock$;

-- A.2  The three language checks allow ${TEN.length} languages (${TEN.join(" ")}).
alter table public.blog_posts drop constraint if exists blog_posts_lang_check;
alter table public.blog_posts add constraint blog_posts_lang_check check (lang in ${tenL});
alter table public.blog_hits drop constraint if exists blog_hits_lang_check;
alter table public.blog_hits add constraint blog_hits_lang_check check (lang in ${tenL});
alter table public.blog_view_totals drop constraint if exists blog_view_totals_lang_check;
alter table public.blog_view_totals add constraint blog_view_totals_lang_check check (lang in ${tenL});

-- A.3  The two functions that carry the list. Everything below is the text of supabase-blog-views-migration.sql with only the language list changed (same grants, same security definer, same search_path).
${hit}
${counts}
-- A.4  Queues ONE fetch of the rows file with pg_net. The request is sent when this execution commits; PART B reads the answer. The file is read from the public repo at the pinned commit, so it cannot change
--      afterwards, and PART B accepts only a body with the md5 and the row count below.
do $queue$
declare
  v_sha constant text := '${sin}';
  v_id  bigint;
begin
  if v_sha !~ '^[0-9a-f]{40}$' then raise exception 'hi/es/fr/ar blog migration: no pinned commit (found %)', v_sha; end if;
  v_id := net.http_get(url := '${url}' || v_sha || '/${rowsFile}', timeout_milliseconds := 60000);
  raise notice 'hi/es/fr/ar blog migration: fetch queued as request %; wait 10-20 seconds, then run PART B', v_id;
end
$queue$;
`;
  const partB = `-- ====================================================================================================================================================================================
-- PART B of 2 — run after PART A, once the fetch has finished (10-20 seconds). Checks the fetched file by its md5 and inserts the rows, in ONE statement. Safe to run again (it then inserts nothing, except an article that was deleted in the meantime).
-- If it says the file has not arrived: wait and run it again; if it keeps saying so, the message shows the latest answer pg_net has (a 404 means the commit is not on GitHub yet).
-- ====================================================================================================================================================================================
do $seed$
declare
  want_md5  constant text := '${md5}';   -- md5 of ${rowsFile}: ${bytes} bytes, ${rows.length} rows (${per})
  want_rows constant int  := ${rows.length};
  want_len  constant int  := ${bytes};
  got       text;
  arr       jsonb;
  seen      text;
  n_new     int;
  n_here    int;
begin
  perform set_config('TimeZone', 'UTC', true);   -- a date-only created_at means midnight UTC, whatever zone this session uses
  select r.content into got from net._http_response r where r.status_code = 200 and md5(r.content) = want_md5 order by r.created desc, r.id desc limit 1;
  if got is null then
    select format('latest answer: request %s, status %s, %s bytes, md5 %s, timed_out %s, error %s', r.id, r.status_code, octet_length(r.content), md5(r.content), r.timed_out, coalesce(r.error_msg, 'none'))
      into seen from net._http_response r order by r.created desc, r.id desc limit 1;
    raise exception 'hi/es/fr/ar blog seed: the rows file (md5 %, % bytes) has not arrived, or what came back is different. Wait 10-20 seconds after PART A and run PART B again; if PART A was run longer ago than 6 hours run it again. %', want_md5, want_len, coalesce(seen, 'net._http_response is empty');
  end if;
  arr := got::jsonb;
  if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) <> want_rows then raise exception 'hi/es/fr/ar blog seed: the rows file is not an array of % rows', want_rows; end if;
  if exists (select 1 from jsonb_to_recordset(arr) as x(lang text) where x.lang is null or x.lang not in ${lt}) then raise exception 'hi/es/fr/ar blog seed: the rows file holds a language other than ${langs.join(" / ")}'; end if;
  insert into public.blog_posts (lang, slug, title, excerpt, body, category, cover_url, published, created_at, updated_at)
  select x.lang, x.slug, x.title, x.excerpt, x.body, x.category, x.cover_url, x.published, x.created_at, x.updated_at
    from jsonb_to_recordset(arr) as x(lang text, slug text, title text, excerpt text, body text, category text, cover_url text, published boolean, created_at timestamptz, updated_at timestamptz)
  on conflict (lang, slug) do nothing;
  get diagnostics n_new = row_count;
  select count(*) into n_here from jsonb_to_recordset(arr) as x(lang text, slug text) join public.blog_posts p on p.lang = x.lang and p.slug = x.slug;
  if n_here <> want_rows then raise exception 'hi/es/fr/ar blog seed: % of % articles are in public.blog_posts after the insert', n_here, want_rows; end if;
  raise notice 'hi/es/fr/ar blog seed: % rows inserted, % were already there', n_new, want_rows - n_new;
end
$seed$;

-- what is in the table now, per language (the last statement, so a client that shows only the last result still shows it)
select p.lang, count(*) as articles, count(*) filter (where p.published) as published from public.blog_posts p where p.lang in ${lt} group by p.lang order by p.lang;
`;
  const first = rows.find(r => r.lang === langs[0]);
  const footer = `-- ====================================================================================================================================================================================
-- After applying (read-only unless stated):
--   select lang, count(*) from public.blog_posts group by lang order by lang;       -- ${langs.join(" / ")} appear with ${per} (plus any rows already there); th / en / zh / ja / ko / ru unchanged
--   select lang, slug, published from public.blog_posts where lang in ${lt} order by lang, slug;
--   select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) from pg_constraint where contype = 'c' and conrelid in ('public.blog_posts'::regclass, 'public.blog_hits'::regclass, 'public.blog_view_totals'::regclass) order by 1, 2;   -- every check of the three tables: each *_lang_check lists ten languages and no other check mentions lang
--   select p.proname, p.prosecdef, p.proconfig, p.proacl, position('''ar''' in pg_get_functiondef(p.oid)) > 0 as knows_ar from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('blog_hit','blog_view_counts') order by 1;   -- true, {search_path=""}, anon and authenticated
--   select relname, relrowsecurity from pg_class where relname in ('blog_posts_backup_hi_es_fr_ar','blog_posts_backup_20261113');                                                                                                                          -- true for both (if the second exists)
--   -- the seeded rows read back and compared with the file in one number (title, excerpt and body of every row, byte for byte): true and ${rows.length} right after PART B; an article the admin edits later makes it false, on purpose
--   select md5(string_agg(p.lang || chr(1) || p.slug || chr(1) || p.title || chr(1) || p.excerpt || chr(1) || p.body, chr(2) order by p.lang collate "C", p.slug collate "C")) = '${digest}' as rows_are_the_files_rows, count(*) as articles from public.blog_posts p where p.lang in ${lt};
--   -- the counter, tried in a transaction that is rolled back (the exception undoes it): the first view is 1 for a new article and the same device again is the same number, an unknown article and an unknown language are -1
--   do $t$ declare s text; a bigint; b bigint; c bigint; d bigint; begin
--     select slug into s from public.blog_posts where lang = '${first.lang}' and published order by slug limit 1;
--     a := public.blog_hit('${first.lang}', s, 'selftest0device01', 'view'); b := public.blog_hit('${first.lang}', s, 'selftest0device01', 'view');
--     c := public.blog_hit('ar', 'no-such-article', 'selftest0device01', 'view'); d := public.blog_hit('xx', s, 'selftest0device01', 'view');
--     raise exception 'self-test, rolled back: first view %, same device again %, unknown article %, unknown language %', a, b, c, d;
--   end $t$;
--
-- Undo, only if the owner asks (nothing below is run by this file), in this order:
--   1. delete from public.blog_hits where lang in ${lt};  delete from public.blog_view_totals where lang in ${lt};  delete from public.blog_posts where lang in ${lt};
--   2. the three alter table statements of A.2 with ${sixL} instead of the ten languages; re-run supabase-blog-views-migration.sql for the two functions.
--   3. public.blog_posts_backup_hi_es_fr_ar holds the whole table as it was before PART A.
`;
  return { header, partA, partB, footer, text: [header, partA, partB, footer].join("\n"), md5, bytes, per, rows };
}

/* ============================== run ============================== */
if (setName === "ja-ko-ru") {
  const posts = postsOf(SET.langs), { sql, per } = inlineSql(posts, SET.langs);
  if (flag.has("--json")) {
    /* --json: the same rows as one JSON array. The SQL file is too big to paste into a SQL tool call (about 300 kB), so a deploy can instead let the database fetch this file itself
       (pg_net) and insert the rows with the same "on conflict (lang, slug) do nothing". Written next to the SQL file; not read by the app. */
    const jf = ROWS_OF(OUT);
    fs.writeFileSync(jf, JSON.stringify(rowsOf(posts)));
    console.log(`gen-blog-seed-sql: wrote ${path.basename(jf)} (${posts.length} rows, ${fs.statSync(jf).size} bytes)`);
    process.exit(0);
  }
  if (flag.has("--check")) {
    const r = compare("sql", OUT, sql);
    if (r.state === "current") { console.log(`gen-blog-seed-sql: ${path.basename(OUT)} is current (${posts.length} articles)`); process.exit(0); }
    console.log(`gen-blog-seed-sql: ${path.basename(OUT)} is ${r.state} — run: node scripts/gen-blog-seed-sql.mjs`); process.exit(1);
  }
  fs.writeFileSync(OUT, sql);
  console.log(`gen-blog-seed-sql: wrote ${path.basename(OUT)} (${posts.length} articles: ${per})`);
  process.exit(0);
}

/* hi / es / fr / ar */
if (SET.langs.some(l => !STATIC_LANGS.includes(l))) die("STATIC_LANGS in scripts/build-blog-pages.mjs (" + STATIC_LANGS.join(",") + ") does not list every language of " + setName + ": readStaticPosts would not read its articles");
const posts = postsOf(SET.langs), rows = rowsOf(posts), rowsText = JSON.stringify(rows);
const problems = [...skippedSources(posts, SET.langs), ...rowProblems(rows, SET.langs)];
if (!rows.length || problems.length) die("the " + setName + " rows are not fit to seed:\n  - " + (problems.length ? problems.join("\n  - ") : "no article found in blog-src/" + SET.langs.join("|") + "/"));
const reg = registryLangs(), drift = !reg || reg.length !== TEN.length || reg.some(l => !TEN.includes(l)) || TEN.some(l => !reg.includes(l));   // an unreadable ALL_LANGS line counts as drift: a check that quietly stops checking is worse than one that stops the run
const driftMsg = !drift ? "" : !reg ? "could not read ALL_LANGS from lang-extra.ts (was the line reformatted or the file moved?): fix registryLangs() in scripts/gen-blog-seed-sql.mjs"
  : `lang-extra.ts lists ${reg.join(",")} but the migration widens the checks to ${TEN.join(",")}: add the new language to TEN in scripts/gen-blog-seed-sql.mjs and to the checks and functions`;
const built = fetchSql({ posts, langs: SET.langs, rowsText, pinned: sha || "" });
const summary = `${rows.length} articles: ${built.per}; rows file ${built.bytes} bytes, md5 ${built.md5}`;

if (sha && !flag.has("--no-git-check") && !flag.has("--json")) {
  const blob = blobAt(sha, path.basename(ROWS_OF(DEFAULT_SQL)));
  if (!blob) die(`git cannot find ${path.basename(ROWS_OF(DEFAULT_SQL))} in commit ${sha}: push the commit that holds the rows file (and git fetch if it was made elsewhere), or pass --no-git-check once you have checked the raw URL yourself`);
  const have = crypto.createHash("md5").update(blob).digest("hex");
  if (have !== built.md5) die(`commit ${sha} holds a rows file with md5 ${have}, blog-src now produces md5 ${built.md5}: commit the regenerated pair first (node scripts/gen-blog-seed-sql.mjs --set hi-es-fr-ar) and pin that commit`);
}
if (opt["--part"]) {
  const text = opt["--part"].toLowerCase() === "a" ? built.partA : built.partB;
  if (!sha && opt["--part"].toLowerCase() === "a") console.error("gen-blog-seed-sql: note: no --sha, so this PART A carries the placeholder " + PLACEHOLDER + " and refuses to run");
  if (OUT_GIVEN) { fs.writeFileSync(OUT, text); console.log(`gen-blog-seed-sql: wrote PART ${opt["--part"].toUpperCase()} to ${OUT}`); } else process.stdout.write(text);
  process.exit(0);
}
const rowsPath = ROWS_OF(OUT);
if (flag.has("--json")) { fs.writeFileSync(rowsPath, rowsText); console.log(`gen-blog-seed-sql: wrote ${path.basename(rowsPath)} (${rows.length} rows, ${built.bytes} bytes)`); process.exit(0); }
if (flag.has("--check")) {
  const checks = [compare("sql", OUT, built.text)]; if (!sha) checks.push(compare("rows", rowsPath, rowsText));   // a release copy has no rows file of its own: the commit holds it
  const stale = checks.filter(c => c.state !== "current");
  if (drift) console.log("gen-blog-seed-sql: " + driftMsg);
  if (!stale.length && !drift) { console.log(`gen-blog-seed-sql: ${checks.map(c => path.basename(c.file)).join(" and ")} ${checks.length > 1 ? "are" : "is"} current (${summary})`); process.exit(0); }
  for (const c of stale) console.log(`gen-blog-seed-sql: ${path.basename(c.file)} is ${c.state} — run: node scripts/gen-blog-seed-sql.mjs --set ${setName}`);
  process.exit(1);
}
if (drift) console.error("gen-blog-seed-sql: warning: " + driftMsg);
fs.writeFileSync(OUT, built.text);
if (sha) { console.log(`gen-blog-seed-sql: wrote the RELEASE copy ${OUT} pinned to ${sha} (${summary}); send PART A, wait 10-20 s, send PART B`); process.exit(0); }
fs.writeFileSync(rowsPath, rowsText);
console.log(`gen-blog-seed-sql: wrote ${path.basename(OUT)} and ${path.basename(rowsPath)} (${summary})`);
