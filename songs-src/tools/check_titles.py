#!/usr/bin/env python3
"""python3 check_titles.py titles-in/batch_N.json titles-out/batch_N.json  -> lists every problem; exit 1 when there is one"""
import json, re, sys
inp = {r['i']: r for r in json.load(open(sys.argv[1]))}
out = json.load(open(sys.argv[2]))
bad = 0
seen = {}
def P(i, m):
    global bad; bad += 1; print(f'  #{i}: {m}')
got = set()
for o in out:
    i = o.get('i'); r = inp.get(i)
    if r is None: P(i, 'unknown index'); continue
    got.add(i)
    if o.get('skip'): continue
    en, th, zh, work = o.get('en', ''), o.get('th', ''), o.get('zh', ''), o.get('work', '')
    c, cth, czh = r['composer'], r['composer_th'], r['composer_zh']
    if not en.endswith(f'({c})'): P(i, f'en must end with "({c})": {en!r}')
    if len(en) > 64: P(i, f'en longer than 64 characters ({len(en)}): {en!r}')
    if not re.search(r'[฀-๿]', th) or not (th.endswith(f'({cth})') or th.endswith(f'（{cth}）')): P(i, f'th must be Thai and end with "({cth})": {th!r}')
    if not re.search(r'[一-鿿]', zh) or not (zh.endswith(f'（{czh}）') or zh.endswith(f'({czh})')): P(i, f'zh must be Chinese and end with "（{czh}）": {zh!r}')
    if not work: P(i, 'work missing')
    if en in seen: P(i, f'en duplicates #{seen[en]}: {en!r}')
    seen[en] = i
for i in inp:
    if i not in got: P(i, 'missing from the output')
print('OK' if not bad else f'{bad} problem(s)')
sys.exit(1 if bad else 0)
