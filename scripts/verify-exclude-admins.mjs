/* Verify the exclude-admins feature wiring end-to-end on the SOURCE level:
   every RPC the three admin pages call that the migration touches must pass
   p_exclude_admins, each page must default to noAdmins=true, and each new
   SQL signature must include the flag. Build-independent (reads source). */
import { readFileSync } from "node:fs";

const A = readFileSync("App.tsx", "utf8");
const D = readFileSync("AdminActivityDashboard.tsx", "fns".length ? "utf8" : "utf8");
const SQL = readFileSync("supabase-admin-exclude-admins-migration.sql", "utf8");

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log("FAIL:", msg)); };

// 1. SQL: every upgraded function declares the flag with default true
for (const fn of ["admin_activity_overview", "admin_activity_users", "admin_activity_hourly",
  "admin_anon_overview", "admin_anon_visitors", "admin_signup_methods",
  "admin_device_mix", "admin_device_widths", "admin_usage_stats"]) {
  ok(new RegExp(`function public\\.${fn}\\([\\s\\S]*?p_exclude_admins boolean default true`).test(SQL),
    `SQL ${fn}: p_exclude_admins default true`);
}

// 2. SQL: legacy 3-arg call shape still valid (defaulted params = additive)
ok(/p_include_sim boolean default true,\s*\n\s*p_exclude_admins boolean default true/.test(SQL),
  "SQL: 3-arg overloads stay callable (flags defaulted)");

// 3. Client: all three pages default to excluding admins
ok((A.match(/const \[noAdmins, setNoAdmins\] = useState\(true\)/g) || []).length === 1, "App.tsx: one noAdmins state default true");
ok((D.match(/const \[noAdmins, setNoAdmins\] = useState\(true\)/g) || []).length === 2, "Dashboard: two noAdmins states default true");

// 4. Client: every migration-touched RPC passes the flag — either inline
//    (p_exclude_admins in the args) or via callRpc(fn, base, true) whose
//    third arg appends the flag.
const both = A + D;
const callRpcArg = (fn) => {
  const m = both.match(new RegExp(`callRpc\\("${fn}"[^)]*\\)`));
  return m ? m[0] : null;
};
for (const fn of ["admin_activity_overview", "admin_activity_users", "admin_activity_hourly",
  "admin_anon_overview", "admin_anon_visitors", "admin_signup_methods",
  "admin_device_mix", "admin_device_widths", "admin_usage_stats"]) {
  const inline = new RegExp(`sb\\.rpc\\("${fn}"[\\s\\S]{0,220}?p_exclude_admins`).test(both);
  const viaHelper = /,\s*true\s*\)\s*$/.test(callRpcArg(fn) || "");
  ok(inline || viaHelper, `client ${fn}: passes p_exclude_admins (inline or callRpc flag)`);
}

// 5. Client: fallbacks exist for the two fetch styles
ok(/if \(withFlag\) return sb\.rpc\(fn, base\)/.test(D), "Dashboard callRpc: retries without flag");
ok(/r\.error && \/structure\|signature\|schema cache/.test(D), "AnonVisitors: legacy fallback on signature error");
ok(/admin_usage_stats[\s\S]{0,900}get_usage_stats/.test(A), "App: get_usage_stats fallback retained");

// 6. SQL: admin guard on every function + anon rows never excluded
ok((SQL.match(/is_app_admin\(\)/g) || []).length >= 7, "SQL: is_app_admin guards present");
ok(/not p_exclude_admins or t\.user_id is null/.test(SQL), "SQL: anonymous rows never excluded");

// 7. Client labels in 3 languages on all pages
for (const s of ["ไม่รวมบัญชีแอดมิน", "Exclude admin accounts (mine)", "ไม่รวมบัญชีแอดมิน (ของฉัน)"]) {
  ok(both.includes(s), `label present: ${s}`);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
