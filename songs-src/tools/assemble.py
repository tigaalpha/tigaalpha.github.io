#!/usr/bin/env python3
"""cands.json (extract.py) -> a ranked, de-duplicated list of the pieces worth a place in the song list: pool.json + pool.tsv
(cands-os.json from extract_openscore.py -> pool-os.json with --os; it leaves out what the app already holds: the tunes in pool.json and, when
$SONGS_WORK/app-songs.json exists (node songs-src/tools/dump_app_songs.mjs), every song of the app, found by the shape of the melody — the
intervals, so a copy in another key or from another edition is found too)

  python3 songs-src/tools/assemble.py [--os [--take=N] [--cap=N]]       --take: at most N pieces that are not named yet (the best-ranked ones), --cap: at most N per composer

Nothing here judges the music (it comes from the score): it chooses WHICH extracted tunes are worth a place in the song list —
tune-like (few rests, in key), playable, not a copy of another — and names them from the score's own header."""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, MUTOPIA
import extract as ex

COMP = ex.COMP
OS = '--os' in sys.argv          # the OpenScore pool (pool-os.json) is kept apart from the Mutopia one: titles are written per pool, by index
cands = json.load(open(f'{WORK}/cands-os.json' if OS else f'{WORK}/cands.json'))
meta = json.load(open(f'{WORK}/meta.json')) if os.path.exists(f'{WORK}/meta.json') else {}

def tier(inst):
    il = (inst or '').lower()
    if re.search(r'quartet|trio|quintet|ensemble|orchestra|duet|strings|concerto|continuo|choir|chorus|horn|trombone|trumpet|mandolin|2 guitars|recorder|clarinet|viola|bass\b|timpani|satb|s\.s\.a', il) and not re.search(r'^(piano|harpsichord|organ)', il):
        return 'B'
    if re.search(r'piano|harpsichord|clavi|organ|guitar|lute|violin|cello|flute|oboe|voice|keyboard', il): return 'A'
    return 'B'

def mid_index(name):
    m = re.search(r'-(\d+)\.mid$', name)
    return int(m.group(1)) if m else 0

PIECE_RE = re.compile(r'piece\s*=\s*(?:\\markup[^"\n]*)?"([^"]+)"')
def piece_names(info):
    src = os.path.join(MUTOPIA, info['path'])
    try: t = open(src, encoding='utf-8', errors='replace').read()
    except Exception: return []
    return [re.sub(r'\s+', ' ', x).strip(' .') for x in PIECE_RE.findall(t)]

def year_of(info, died):
    m = re.search(r'(1[5-9]\d\d)', info.get('date') or '')
    y = int(m.group(1)) if m else None
    if y is None or y > 1929: y = min(died, 1929) if y is None else y
    return y

rows = []
for r in cands:
    if not r['ok']: continue
    info = r['info']
    code = info['composer'].replace('Mozart W.A.', 'MozartWA')
    if code not in COMP: continue
    short, full, died, era, th, zh = COMP[code]
    r['code'] = code; r['tier'] = tier(info['instrument'])
    rows.append(r)

# movement names for pieces with several MIDI files
by_pid = collections.defaultdict(list)
for r in rows: by_pid[r['pid']].append(r)
allmids = collections.defaultdict(list)
for r in cands:
    allmids[r['pid']].append(r['mid'])
for pid, lst in by_pid.items():
    mids = sorted(set(allmids[pid]), key=lambda n: (mid_index(n), n))      # by the number in the name, then by name: the same order every run
    names = piece_names(meta[pid]) if pid in meta else []
    for r in lst:
        i = mids.index(r['mid'])
        r['mvt'] = names[i] if len(names) == len(mids) and len(mids) > 1 else (f'Part {i + 1}' if len(mids) > 1 else '')
        r['nmid'] = len(mids)

def opening(r, n=14):
    notes = []
    for b in r['bars']:
        for t in b.split():
            nm, d = t.split(':')
            if nm != 'R': notes.append((nm, d))
    return tuple(n_[0] for n_ in notes[:n])

SKIP_CODES = {'SousaJP'}
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', (t or '').lower()).strip()

PCN = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi_of(nm):
    m = re.match(r'^([A-G])(#?)(-?\d)$', nm)
    return 12 * (int(m.group(3)) + 1) + PCN[m.group(1)] + (1 if m.group(2) else 0)
SHL, SHD = 10, 4        # a shingle is 10 successive intervals with at least 4 different sizes: a plain scale or a repeated note is in every tune
def shingles(pitches):
    iv = [b - a for a, b in zip(pitches, pitches[1:])]
    return {tuple(iv[i:i + SHL]) for i in range(len(iv) - SHL + 1) if len(set(iv[i:i + SHL])) >= SHD}
def pitches_of(r):
    return [midi_of(t.split(':')[0]) for b in r['bars'] for t in b.split() if not t.startswith('R:')]
SH_OF = {}                                   # id -> the shingles of a tune already taken
SH_INDEX = collections.defaultdict(list)     # shingle -> ids
def sh_add(id_, sh):
    SH_OF[id_] = sh
    for g in sh: SH_INDEX[g].append(id_)
def sh_clash(sh):
    """the id of a tune that is the same melody (a copy, in another key or from another edition), or None"""
    cnt = collections.Counter(j for g in sh for j in SH_INDEX.get(g, ()))
    for j, n in cnt.most_common():
        if n >= 8 or (n >= 4 and n >= 0.5 * min(len(sh), len(SH_OF[j]))): return j
    return None

pool = []
seen_open = {}
seen_work = {}
named = set()
if OS:      # nothing the app already holds is taken a second time
    named = {k for k, v in json.load(open(f'{WORK}/titles-by-key.json')).items() if not v.get('skip')} if os.path.exists(f'{WORK}/titles-by-key.json') else set()
    for r0 in json.load(open(f'{WORK}/pool.json')):
        seen_open[opening(r0)] = r0['pid']
        seen_work[(r0['code'], norm(r0['info']['title']), norm(r0.get('mvt', '')), norm(r0['info']['opus']))] = r0['pid']
    if os.path.exists(f'{WORK}/app-songs.json'):
        for s0 in json.load(open(f'{WORK}/app-songs.json')): sh_add('app:' + s0['id'], shingles([midi_of(n) for n in s0['notes']]))
    else:
        for r0 in json.load(open(f'{WORK}/pool.json')): sh_add('pool:' + r0['pid'], shingles(pitches_of(r0)))
def quality(r):
    q = 0.0
    q += {'A': 3.0, 'B': 0.5}[r['tier']]
    q += (1 - min(1, r['rest'] / 0.30)) * 2           # few rests
    q -= 1.5 * min(1, r.get('short_rests', 0) / 0.22)   # detached, alternating notes are not a tune
    q += 1.0 if r['diatonic'] >= 0.93 else (0.5 if r['diatonic'] >= 0.88 else 0)
    q -= 0.7 * abs(r['semis'])                         # a transposition is a cost
    q += 1.0 if 16 <= r['sec'] <= 45 else 0
    q += 0.8 if 24 <= r['notes'] <= 130 else 0
    q -= 0.6 if r['offgrid'] > 0.08 else 0
    q -= 1.0 if r.get('intro_skipped') else 0
    return q
def rest_stats(r):
    n_notes = 0; short = 0
    for b in r['bars']:
        for t in b.split():
            nm, d = t.split(':')
            if nm == 'R':
                if float(d) <= 0.5: short += 1
            else: n_notes += 1
    return short / max(1, n_notes)
for r in rows:
    r['short_rests'] = round(rest_stats(r), 3)
    r['q'] = quality(r)
rows.sort(key=lambda r: -r['q'])
dropped = []; n_new = 0; per_comp = collections.Counter()
TAKE = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--take=')), 0)
CAP = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--cap=')), 0)
for r in rows:
    if r['code'] in SKIP_CODES: continue
    if r['tier'] == 'A':
        dia_min = 0.70 if COMP[r['code']][3] == 'impressionism' else 0.85       # Debussy's colour is chromatic and modal: the notes are the score's
        if r['rest'] > 0.30 or r['short_rests'] > 0.22 or r['diatonic'] < dia_min or abs(r['semis']) > 5: continue
    else:
        if r['rest'] > 0.20 or r['short_rests'] > 0.12 or r['diatonic'] < 0.90 or abs(r['semis']) > 3: continue
    if r['notes'] < 16 or r['notes'] > 170: continue
    k = opening(r)
    if len(k) < 10: continue
    if k in seen_open: continue
    wk = (r['code'], norm(r['info']['title']), norm(r.get('mvt', '')), norm(r['info']['opus']))
    if wk in seen_work: continue            # the same work again (another paper size, another key): the best-ranked one is already in
    if OS:
        new_piece = (r['pid'] + '|' + r['mid']) not in named
        if new_piece and ((TAKE and n_new >= TAKE) or (CAP and per_comp[r['code']] >= CAP)): continue
        sh = shingles(pitches_of(r))
        j = None if (r['pid'] + '|' + r['mid']) in named else sh_clash(sh)      # a piece that is already named is in the app: it is the app's copy that the others are compared with
        if j: dropped.append((r['info']['title'], r['code'], j)); continue
        sh_add('os:' + r['pid'], sh)
        n_new += new_piece; per_comp[r['code']] += 1
    seen_open[k] = r['pid']; seen_work[wk] = r['pid']
    pool.append(r)

tag = 'pool-os' if OS else 'pool'
json.dump(pool, open(f'{WORK}/{tag}.json', 'w'), ensure_ascii=False)
with open(f'{WORK}/{tag}.tsv', 'w') as f:
    f.write('i\tq\ttier\tcode\ttitle\topus\tmvt\tinst\tmeter\tbpm\tkey\tbars\tnotes\tsec\tsemis\trest\tpid\tmid\n')
    for i, r in enumerate(pool):
        info = r['info']
        f.write('\t'.join(map(str, [i, round(r['q'], 1), r['tier'], r['code'], info['title'], info['opus'], r.get('mvt', ''), info['instrument'][:22], r['meter'], r['bpm'], r['key'], len(r['bars']), r['notes'], r['sec'], r['semis'], r['rest'], r['pid'], r['mid']])) + '\n')
if OS and '-v' in sys.argv:
    for t, code, j in dropped: print('  left out:', code, t, '== same melody as', j)
c = collections.Counter((r['code'], r['tier']) for r in pool)
print(len(rows), 'extracted ok;', len(pool), 'in the pool' + (f'; {len(dropped)} left out as a melody the app already has' if OS else ''))
print('tier A', sum(1 for r in pool if r['tier'] == 'A'), '· tier B', sum(1 for r in pool if r['tier'] == 'B'))
print(sorted(((k, v) for k, v in collections.Counter(r['code'] for r in pool if r['tier'] == 'A').items()), key=lambda x: -x[1])[:30])
