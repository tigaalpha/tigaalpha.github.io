#!/bin/sh
# tmp-merge-fix.sh — resolve the zero-drift merge conflicts per repo convention:
#  1. index.html/sw.js: built artifacts → rebuilt below, conflicts get
#     overwritten; stage ours now just to end the conflicted state.
#  2. bundle/ rename-rename & delete-vs-rename storms: every side is a hashed
#     build of the same source, so a plain merge would leave ONE build only and
#     404 the other references. Convention (1278e66b "Rebuild artifacts for
#     the v3.4/v3.5 merge"): keep the UNION of both builds, drop NOTHING,
#     then rebuild on top — the rebuild regenerates the current hashes and the
#     extra legacy files are harmless (they disappear next time pages rebuilds).
set -e
git add index.html sw.js
# every conflicted/unmerged path in bundle/ → keep BOTH sides' files on disk,
# stage the union, clear the conflict markers
git status --porcelain | awk '$1 ~ /^(UU|AA|DD|AU|UA|DU|UD)$/ && $2 ~ /^bundle\// {print $2}' > /tmp/conflicted.txt
while IFS= read -r f; do
  git show ":1:$f" > "$f" 2>/dev/null || true   # base
  git show ":2:$f" > "$f" 2>/dev/null || true   # ours
  git show ":3:$f" > "$f" 2>/dev/null || true   # theirs (wins if present)
  git add -f "$f" 2>/dev/null || git rm -f --cached -q "$f" 2>/dev/null || true
done < /tmp/conflicted.txt
# restore any file a "DD/UD/DU" resolution removed from disk but that still
# exists on either side (unions must survive)
for f in $(git diff --name-only --diff-filter=U HEAD 2>/dev/null || true); do
  git show ":2:$f" > "$f" 2>/dev/null || git show ":3:$f" > "$f" 2>/dev/null || true
  git add -f "$f" 2>/dev/null || true
done
git diff --name-only --diff-filter=U || true
echo "unmerged remaining: $(git diff --name-only --diff-filter=U | wc -l)"
