#!/usr/bin/env python3
"""pool.json / pool-os.json -> the rows a person (or a model) names:  $SONGS_WORK/titles-in[-os]/all.json  and  batch_1..N.json

  python3 titles_in.py [--os] [N]        N batches (default 6)

Each row: i (the index in the pool), key (the score it is about: `pid|file` — names are stored by it, so they survive a new extraction run), era, composer (short name, use exactly), composer_th / composer_zh,
raw_title / opus / movement / instrument / date (from the score's header: noisy, may be German or French), key_in_app +
transposed_semitones (the excerpt is played in key_in_app: never take a key for a title from it), bars, meter, tempo.
The answer is a JSON array in titles-out[-os]/batch_K.json: {"i", "en", "th", "zh", "work"} per row (or {"i", "skip": true});
`python3 check_titles.py titles-in/batch_K.json titles-out/batch_K.json` lists what is wrong with it, and
`python3 titles_merge.py [--os]` files the answers under their keys in titles-by-key.json (what finalize.py reads).
`--missing` writes only the rows of the pool that have no name yet (after a new extraction run: the new pieces)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK
import extract as ex

OS = '--os' in sys.argv
nums = [a for a in sys.argv[1:] if a.isdigit()]
N = int(nums[0]) if nums else 6
pool = json.load(open(f'{WORK}/pool-os.json' if OS else f'{WORK}/pool.json'))
named = json.load(open(f'{WORK}/titles-by-key.json')) if os.path.exists(f'{WORK}/titles-by-key.json') else {}
rows = []
for i, r in enumerate(pool):
    if '--missing' in sys.argv and (r['pid'] + '|' + r['mid']) in named: continue
    info = r['info']; short, full, died, era, th, zh = ex.COMP[r['code']]
    rows.append({'i': i, 'key': r['pid'] + '|' + r['mid'], 'era': era, 'composer': short, 'composer_th': th, 'composer_zh': zh,
                 'raw_title': info.get('title', ''), 'opus': info.get('opus', ''), 'movement': r.get('mvt', ''), 'instrument': info.get('instrument', ''),
                 'key_in_app': r['key'], 'transposed_semitones': r['semis'], 'date': info.get('date', ''),
                 'bars': len(r['bars']), 'meter': r['meter'], 'tempo': r['bpm']})
d = f'{WORK}/titles-in-os' if OS else f'{WORK}/titles-in'
os.makedirs(d, exist_ok=True)
os.makedirs(d.replace('titles-in', 'titles-out'), exist_ok=True)
json.dump(rows, open(f"{d}/{'missing' if '--missing' in sys.argv else 'all'}.json", 'w'), ensure_ascii=False)
size = (len(rows) + N - 1) // N
for k in range(N):
    part = rows[k * size:(k + 1) * size]
    if part: json.dump(part, open(f"{d}/batch_{'m' if '--missing' in sys.argv else ''}{k + 1}.json", 'w'), ensure_ascii=False)      # batch_mK: the unnamed rows of a later run
print(len(rows), 'rows ->', d)
