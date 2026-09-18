/* Verify the callRpc fix in AdminActivityDashboard: supabase-js RESOLVES with
   {error} (does not reject), so the legacy-RPC fallback must trigger from a
   resolved error. Extracts the real callRpc source from the file — no copy. */
import { readFileSync } from "node:fs";

const src = readFileSync("AdminActivityDashboard.tsx", "utf8");
const start = src.indexOf("const callRpc = (fn, base, withFlag) => {");
const end = src.indexOf("\n    };", start);
if (start < 0 || end < 0) { console.error("callRpc block not found"); process.exit(1); }
// eslint-disable no-eval — build-time test only
// callRpc closes over `sb` and `noAdmins` in the component — inject both via a
// factory so the REAL body runs against mocks.
const makeCallRpc = eval("(sb, noAdmins) => " + src.slice(start + "const callRpc = ".length, end + 6));
let sb; // set per-case below
const callRpc = (fn, base, withFlag) => makeCallRpc(sb, true)(fn, base, withFlag);

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };

// Case 1 (the bug): new RPC not applied -> supabase resolves with an error
// object -> must retry WITHOUT the flag and return that data.
let legacyCalled = 0;
sb = {
  rpc: (fn, args) => {
    if (args && "p_exclude_admins" in args) return Promise.resolve({ data: null, error: { message: "Could not find the function admin_activity_overview(timestamptz, boolean, boolean) in the schema cache" } });
    legacyCalled++;
    return Promise.resolve({ data: { users: 7 }, error: null });
  },
};
const r1 = await callRpc("admin_activity_overview", { p_since: null, p_include_sim: false }, true);
ok(legacyCalled === 1, "resolved-error triggers legacy retry");
ok(r1 && r1.users === 7, "legacy data returned after resolved error");

// Case 2: normal success with the flag -> no legacy call.
let called2 = 0;
sb = { rpc: () => { called2++; return Promise.resolve({ data: { events: 12 }, error: null }); } };
const r2 = await callRpc("admin_activity_users", {}, true);
ok(called2 === 1 && r2.events === 12, "success passes straight through");

// Case 3: hard network failure (rejection) with flag -> legacy retry still works.
let legacy3 = 0;
sb = {
  rpc: (fn, args) => {
    if (args && "p_exclude_admins" in args) return Promise.reject(new Error("network"));
    legacy3++;
    return Promise.resolve({ data: [1, 2, 3], error: null });
  },
};
const r3 = await callRpc("admin_anon_overview", {}, true);
ok(legacy3 === 1 && Array.isArray(r3) && r3.length === 3, "rejection path still falls back");

// Case 4: without the flag, a resolved error just yields null (never throws).
sb = { rpc: () => Promise.resolve({ data: null, error: { message: "admin only" } }) };
const r4 = await callRpc("admin_signup_methods", {}, false);
ok(r4 === null, "no-flag error yields null");

// Case 5: both attempts fail -> null, no throw.
sb = { rpc: () => Promise.reject(new Error("down")) };
const r5 = await callRpc("admin_device_mix", {}, true);
ok(r5 === null, "double failure yields null");

console.log(`${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
