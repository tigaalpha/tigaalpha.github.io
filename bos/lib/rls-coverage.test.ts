import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Regression test for a real gap the Level 5 Wave 1 audit found:
// ai_rate_limits (migration 0024) was the only table across 63 prior
// migrations created without `enable row level security`. Reads every
// migration file directly (no live database needed) and asserts every
// `create table` has a matching `enable row level security` line
// somewhere in the migration set, so this class of gap can't silently
// ship again.

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

function readAllMigrationsText(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8")).join("\n");
}

function extractCreatedTables(sql: string): Set<string> {
  const tables = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql))) tables.add(match[1]!);
  return tables;
}

function extractRlsEnabledTables(sql: string): Set<string> {
  const tables = new Set<string>();
  const re = /alter\s+table\s+"?(\w+)"?\s+enable\s+row\s+level\s+security/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql))) tables.add(match[1]!);
  return tables;
}

describe("every table created in a migration has row level security enabled", () => {
  const sql = readAllMigrationsText();
  const createdTables = extractCreatedTables(sql);
  const rlsEnabledTables = extractRlsEnabledTables(sql);

  it("found a non-trivial number of tables (sanity check the parser itself works)", () => {
    expect(createdTables.size).toBeGreaterThan(30);
  });

  it.each([...createdTables].sort())("%s has RLS enabled", (table) => {
    expect(rlsEnabledTables.has(table)).toBe(true);
  });
});
