#!/usr/bin/env python3
"""titles-out[-os]/batch_*.json (the answers) + titles-in[-os]/batch_*.json (the rows, with their keys)  ->  titles-by-key.json

  python3 titles_merge.py [--os]

Names are filed under the key of the score they are about (`pid|file`, the row's `key`), not under the row's index: a new extraction
run reorders the pool, and the names must still find their pieces. A batch with problems (check_titles.py) is refused; an answer
for a key already named replaces it (the later batch wins)."""
import json, os, sys, glob, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK

OS = '--os' in sys.argv
din, dout = (f'{WORK}/titles-in-os', f'{WORK}/titles-out-os') if OS else (f'{WORK}/titles-in', f'{WORK}/titles-out')
dest = f'{WORK}/titles-by-key.json'
by_key = json.load(open(dest)) if os.path.exists(dest) else {}
added = 0; bad = 0
for fo in sorted(glob.glob(f'{dout}/batch_*.json')):
    name = os.path.basename(fo)
    fi = f'{din}/{name}'
    if not os.path.exists(fi): print('no input rows for', name); bad += 1; continue
    chk = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check_titles.py'), fi, fo], capture_output=True, text=True)
    if chk.returncode != 0: print(name, 'has problems, left out:\n' + chk.stdout[-600:]); bad += 1; continue
    rows = {r['i']: r for r in json.load(open(fi))}
    for o in json.load(open(fo)):
        r = rows.get(o['i'])
        if r is None or 'key' not in r: continue
        by_key[r['key']] = {'skip': True} if o.get('skip') else {k: o[k] for k in ('en', 'th', 'zh', 'work')}
        added += 1
json.dump(by_key, open(dest, 'w'), ensure_ascii=False, indent=0)
print(added, 'names filed;', len(by_key), 'in titles-by-key.json;', bad, 'batch(es) refused')
