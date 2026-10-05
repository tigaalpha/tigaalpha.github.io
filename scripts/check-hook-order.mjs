/* Static guard against React's "Rendered more hooks than during the previous
   render" crash (minified as "Minified React error #310").

   The production bundle is minified, so the stack React hands to the
   ErrorBoundary points at react-dom internals (updateWorkInProgressHook ->
   useReducer -> useState) and never names the component that broke. This
   script finds the same class of bug in the source instead: a hook called
   conditionally — behind an if/ternary/logical test, inside a loop or switch
   case, or after a `return` in the same component.

   Any hit is a real crash waiting for the right account state, so the script
   fails loudly instead of printing suggestions.

   It walks the AST by hand rather than using @babel/traverse: these files are
   big enough that traverse's scope bookkeeping is slow, and it hard-fails on
   legitimately duplicated top-level bindings (i18n.ts declares SEVENTH_TYPES
   twice). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

const HOOKS = new Set([
  "useState", "useEffect", "useLayoutEffect", "useInsertionEffect",
  "useMemo", "useCallback", "useRef", "useReducer", "useContext",
  "useImperativeHandle", "useDebugValue", "useDeferredValue",
  "useTransition", "useSyncExternalStore", "useId",
]);

/* A hook list belongs to exactly one function, so the walk treats these as
   hard boundaries and never looks inside them. */
const FN = new Set(["FunctionDeclaration", "FunctionExpression",
  "ArrowFunctionExpression", "ObjectMethod", "ClassMethod",
  "ClassPrivateMethod"]);
const SKIP_KEYS = new Set(["loc", "start", "end", "range", "extra",
  "leadingComments", "trailingComments", "innerComments", "comments"]);

/* The project's own `use*` functions are hooks too, and calling one behind a
   condition breaks hook order exactly the same way. They are collected per
   file from top-level declarations and imports, so `useChat()` inside an `if`
   is caught alongside `useState()` inside an `if`. */
const CUSTOM = new Set();

function collectHooks(ast) {
  for (const n of ast.program.body) {
    const name = n.type === "FunctionDeclaration" ? n.id?.name
      : n.type === "VariableDeclaration" ? n.declarations[0]?.id?.name
      : n.type === "ExportNamedDeclaration" ? (n.declaration?.id?.name ||
          n.declaration?.declarations?.[0]?.id?.name)
      : null;
    if (name && /^use[A-Z]/.test(name)) CUSTOM.add(name);
  }
  for (const n of ast.program.body) {
    const src = n.type === "ImportDeclaration" ? n : null;
    if (!src) continue;
    for (const sp of src.specifiers || []) {
      if (sp.local && /^use[A-Z]/.test(sp.local.name)) CUSTOM.add(sp.local.name);
    }
  }
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-landing",
  "bundle", "android", "ios", "updates", "public", "songs", "landing",
  "landing-en", "landing-zh", "studio", "payqr", "img", "assets", "fonts",
  "docs", ".claude", ".github"]);

function filesIn(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) filesIn(p, out);
    else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/* First hook call inside an expression, without crossing a function boundary.
   `conditional` becomes true once the search passes through a `&&`, `||` or
   `?:` — those operands only evaluate on some renders. */
function findHook(node, conditional = false) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findHook(n, conditional);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node.type !== "string" || FN.has(node.type)) return null;
  if (node.type === "CallExpression" && node.callee.type === "Identifier" &&
      (HOOKS.has(node.callee.name) || CUSTOM.has(node.callee.name))) {
    return { hook: node.callee.name, node };
  }
  const cond = conditional ||
    node.type === "LogicalExpression" || node.type === "ConditionalExpression";
  for (const k of Object.keys(node)) {
    if (SKIP_KEYS.has(k)) continue;
    const hit = findHook(node[k], cond);
    if (hit) return hit;
  }
  return null;
}

/* Does this statement always return? Only needed for the `if (x) return ...`
   early-return shape, which is what actually shifts a hook list. */
function alwaysReturns(st) {
  if (!st) return false;
  if (st.type === "ReturnStatement" || st.type === "ThrowStatement") return true;
  if (st.type !== "BlockStatement") return false;
  for (const s of st.body) {
    if (s.type === "ReturnStatement") return true;
    if (s.type === "IfStatement" && !s.alternate && alwaysReturns(s.consequent)) return true;
  }
  return false;
}

/* ctx: { file, fn, depth, returned } — depth counts enclosing conditional
   branches; returned records that a sibling already bailed out. */
function scanStatements(list, ctx) {
  for (const st of list) {
    if (!st) continue;

    /* A hook at statement level is legal only when it always runs. */
    if (st.type === "ExpressionStatement" || st.type === "VariableDeclaration") {
      const hit = findHook(st.type === "ExpressionStatement" ? st.expression : st);
      if (hit) {
        if (ctx.depth > 0) {
          ctx.problems.push({
            file: ctx.file, fn: ctx.fn, line: hit.node.loc?.start.line ?? 0,
            hook: hit.hook, why: `hook inside a conditional (depth ${ctx.depth})`,
          });
        } else if (ctx.returned) {
          ctx.problems.push({
            file: ctx.file, fn: ctx.fn, line: hit.node.loc?.start.line ?? 0,
            hook: hit.hook, why: "hook after a return in the same component",
          });
        }
      }
    }

    if (st.type === "ReturnStatement" || st.type === "ThrowStatement") {
      ctx.returned = true;
      continue;
    }

    if (st.type === "IfStatement") {
      /* An `if (x) return ...` with no else makes every later hook conditional. */
      const bails = !st.alternate && alwaysReturns(st.consequent);
      for (const arm of [st.consequent, st.alternate]) {
        if (!arm) continue;
        if (arm.type === "BlockStatement") {
          scanStatements(arm.body, { ...ctx, depth: ctx.depth + 1, returned: false });
        } else if (arm.type === "ReturnStatement") {
          /* nothing to scan */
        } else {
          scanNode(arm, { ...ctx, depth: ctx.depth + 1, returned: false });
        }
      }
      if (bails) ctx.returned = true;
      continue;
    }

    if (st.type === "SwitchStatement") {
      for (const c of st.cases) {
        scanStatements(c.consequent, { ...ctx, depth: ctx.depth + 1, returned: false });
      }
      continue;
    }

    const insideBranch = ["ForStatement", "ForOfStatement", "ForInStatement",
      "WhileStatement", "DoWhileStatement", "TryStatement", "LabeledStatement"];
    scanNode(st, { ...ctx, depth: insideBranch.includes(st.type) ? ctx.depth + 1 : ctx.depth });
  }
}

/* Descend without reporting, so only statements get judged. Plain blocks keep
   the depth; `if`/`switch`/loops raise it. */
function scanNode(node, ctx) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { scanStatements(node, ctx); return; }
  if (typeof node.type !== "string" || FN.has(node.type)) return;

  if (node.type === "BlockStatement" || node.type === "Program") {
    scanStatements(node.body, ctx);
    return;
  }
  if (node.type === "IfStatement") { scanStatements([node], ctx); return; }
  if (node.type === "SwitchStatement") { scanStatements([node], ctx); return; }
  if (node.type === "SwitchCase") { scanStatements(node.consequent, ctx); return; }
  if (node.type === "TryStatement") {
    scanNode(node.block, ctx);
    scanNode(node.handler, { ...ctx, depth: ctx.depth + 1 });
    scanNode(node.finalizer, ctx);
    return;
  }
  if (node.type === "CatchClause") { scanNode(node.body, { ...ctx, depth: ctx.depth + 1 }); return; }
  for (const k of Object.keys(node)) {
    if (SKIP_KEYS.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const n of v) scanNode(n, ctx); }
    else if (v && typeof v === "object") scanNode(v, ctx);
  }
}

const problems = [];

for (const file of filesIn(".")) {
  const ast = parse(readFileSync(file, "utf8"), {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: true,
  });
  collectHooks(ast);

  const visit = (n, name) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(x => visit(x, name)); return; }
    if (typeof n.type !== "string") return;
    if (n.type === "ObjectProperty") { visit(n.value, name); return; }
    if (n.type === "VariableDeclarator") {
      visit(n.init, n.id && n.id.type === "Identifier" ? n.id.name : name);
      return;
    }
    if (FN.has(n.type)) {
      const label = (n.id && n.id.name) ||
        (n.key && (n.key.name || n.key.value)) || name || "<anonymous>";
      if (n.body && n.body.type === "BlockStatement") {
        scanStatements(n.body.body, { file, fn: label, depth: 0, returned: false, problems });
      } else {
        visit(n.body, label);
      }
      return;
    }
    for (const k of Object.keys(n)) {
      if (SKIP_KEYS.has(k)) continue;
      visit(n[k], name);
    }
  };
  visit(ast, null);
}

if (!problems.length) {
  console.log("hook-order: OK — no conditional or post-return hooks found");
  process.exit(0);
}
const seen = new Set();
for (const p of problems) {
  const key = `${p.file}:${p.line}:${p.hook}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${p.file}:${p.line}  ${p.fn}() calls ${p.hook}() — ${p.why}`);
}
console.log(`\nhook-order: FAIL — ${seen.size} hook-order violation(s)`);
process.exit(1);
