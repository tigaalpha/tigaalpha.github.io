import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.tiigacode']);
const HARD_CAP = 20_000;

function walk(dir, root, out) {
  if (out.length >= HARD_CAP) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= HARD_CAP) return;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, out);
    } else {
      out.push(relative(root, full).split(sep).join('/'));
    }
  }
}

// Supports "*" (within a path segment), "?" (one char), and "**" (across segments).
function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function globSearch(pattern, root = process.cwd(), limit = 200) {
  const files = [];
  walk(root, root, files);
  const re = globToRegExp(pattern);
  return files.filter((f) => re.test(f)).slice(0, limit);
}

export function listAllFiles(root = process.cwd(), limit = 5000) {
  const files = [];
  walk(root, root, files);
  return files.slice(0, limit);
}
