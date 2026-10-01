#!/usr/bin/env python3
"""pool.json (+ pool-os.json) and the names in titles-by-key.json  ->  songs-src/classical/<composer>.json   (the pieces, in the authoring format)

  python3 songs-src/tools/finalize.py [OUTDIR]        (default: <repo>/songs-src/classical; the folder's *.json are replaced)

Every note comes from a typeset public-domain score (Mutopia Project "Public Domain", or an OpenScore Lieder transcription, CC0);
`src` records the file."""
import json, os, re, sys, glob, collections, hashlib, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, REPO
import extract as ex

OUT = sys.argv[1] if len(sys.argv) > 1 else f'{REPO}/songs-src/classical'


# names are filed under the key of their score (titles_merge.py), so they survive a new extraction run
titles = json.load(open(f'{WORK}/titles-by-key.json'))
# the Mutopia pool and (when there is one) the OpenScore pool
sources = [(json.load(open(f'{WORK}/pool.json')), 'mutopia')]
if os.path.exists(f'{WORK}/pool-os.json'): sources.append((json.load(open(f'{WORK}/pool-os.json')), 'openscore'))
existing_ids = set(json.load(open(f'{WORK}/existing-ids.json'))) if os.path.exists(f'{WORK}/existing-ids.json') else set()
# pieces to leave out after naming (a list of ids or `pid|file` keys in $SONGS_WORK/exclude-ids.json, e.g. a tune that turned out to be a copy)
exclude = set(json.load(open(f'{WORK}/exclude-ids.json'))) if os.path.exists(f'{WORK}/exclude-ids.json') else set()
LICENSE = {'mutopia': 'Public Domain (Mutopia Project header)', 'openscore': 'CC0 1.0 (OpenScore Lieder transcription of a public-domain score)'}


def ascii_slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


DROP_WORDS = {'in', 'the', 'of', 'for', 'and', 'from', 'no', 'major', 'minor', 'op', 'bwv', 'k', 'd', 'hwv', 'hob'}


def make_id(composer_short, en):
    base = re.sub(r'\s*\([^()]*\)\s*$', '', en)               # without the composer in brackets
    c = ascii_slug(composer_short)
    full = f'{c}_{ascii_slug(base)}'
    if len(full) <= 40: return full
    words = [w for w in ascii_slug(base).split('_') if w]
    keep = [w for w in words if w not in DROP_WORDS or w.isdigit()]
    cand = f'{c}_' + '_'.join(keep)
    if len(cand) <= 40: return cand
    h = hashlib.md5(base.encode()).hexdigest()[:4]
    return (cand[:35]).rstrip('_') + '_' + h


PCN = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def in_key_share(key, bars):
    """the share of the notes that are in the key's scale, counted by notes (what scripts/verify-songs.mjs checks), not by duration"""
    m = re.match(r'^([A-G])([#b]?)(m?)$', key)
    tonic = (PCN[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]) % 12
    scale = {(tonic + d) % 12 for d in ([0, 2, 3, 5, 7, 8, 9, 10, 11] if m.group(3) else [0, 2, 4, 5, 7, 9, 11])}
    pcs = []
    for b in bars:
        for tok in b.split():
            nm = tok.split(':')[0]
            if nm != 'R':
                mm = re.match(r'^([A-G])(#?)(\d)$', nm)
                pcs.append((PCN[mm.group(1)] + (1 if mm.group(2) else 0)) % 12)
    return sum(1 for p in pcs if p in scale) / max(1, len(pcs))


by_comp = collections.defaultdict(list)
used = set(existing_ids)
skipped = []


def emit(pool, kind):
    for i, r in enumerate(pool):
        t = titles.get(r['pid'] + '|' + r['mid'])
        if not t or t.get('skip'): skipped.append((kind, i, 'no title' if not t else 'skip')); continue
        info = r['info']; short, full, died, era, th, zh = ex.COMP[r['code']]
        pid = make_id(short, t['en'])
        base = pid; n = 2
        while pid in used:
            pid = (base[:36] + f'_{n}'); n += 1
        if pid in exclude or base in exclude or (r['pid'] + '|' + r['mid']) in exclude: skipped.append((kind, i, 'excluded')); continue
        used.add(pid)
        m = re.search(r'(1[4-9]\d\d)', info.get('date') or '')
        year = int(m.group(1)) if m else min(died, 1929)       # no date in the score's header: the latest the piece can be is the composer's last year
        year = min(year, 1929)
        piece = {
            'id': pid, 'era': era, 'composer': full, 'died': died, 'year': year, 'work': t.get('work', ''),
            'en': t['en'], 'th': t['th'], 'zh': t['zh'],
            'key': r['key'], 'meter': r['meter'], 'bpm': r['bpm'], 'pickup': r['pickup'], 'bars': r['bars'],
            'conf': 'high',
            'src': info['path'] if kind == 'openscore' else 'mutopia:' + info['path'],
            'license': LICENSE[kind],
        }
        if in_key_share(r['key'], r['bars']) < 0.88:            # chromatic or modal writing (Debussy, Satie): the notes are the score's, so the key check is relaxed
            piece['scale'] = 'modal'
            piece['note'] = 'chromatic/modal writing as in the score'
        if r['semis']: piece['note'] = (piece.get('note', '') + '; ' if piece.get('note') else '') + f"transposed {r['semis']:+d} semitone(s) to fit C4-B5"
        if r.get('skipped_bars'): piece['note'] = (piece.get('note', '') + '; ' if piece.get('note') else '') + f"starts {r['skipped_bars']} bar(s) into the piece"
        if r.get('scale') == 2.0: piece['note'] = (piece.get('note', '') + '; ' if piece.get('note') else '') + 'eighth-note meter written in doubled note values'
        by_comp[ascii_slug(short).replace('_', '')].append(piece)


for pool, kind in sources:
    emit(pool, kind)

os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.json'): os.remove(f)
for code, arr in sorted(by_comp.items()):
    arr.sort(key=lambda p: p['id'])
    with open(f'{OUT}/{code}.json', 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps(p, ensure_ascii=False) for p in arr) + '\n]\n')
print(sum(len(a) for a in by_comp.values()), 'pieces in', len(by_comp), 'files;', len(skipped), 'left out:', skipped[:10])
