#!/usr/bin/env python3
"""Compile the candidate Mutopia main files to MIDI with the bundled LilyPond. Resumable: skips ids that already have a .done marker."""
import json, os, re, subprocess, sys, hashlib, time
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, MUTOPIA, MIDI, REPO, lilypond_bin_dir
from concurrent.futures import ThreadPoolExecutor
ROOT = MUTOPIA
LY = os.environ.get('LYBIN') or os.path.join(lilypond_bin_dir('venv'), 'lilypond')
RETRY = os.environ.get('RETRY') == '1'
TAG = os.environ.get('TAG') or ''
OUT = MIDI
os.makedirs(OUT, exist_ok=True)
inv = json.load(open(f'{WORK}/inventory.json'))

PD_BAD_STYLE = {'technique', 'jazz', 'avant-garde', 'hymn', 'song', 'strophic with chorus'}
OK_INST = re.compile(r'(piano|harpsichord|clavi|organ|guitar|violin|cello|flute|oboe|clarinet|lute|recorder|voice|string quartet|string ensemble|ensemble|orchestra|trio|quartet)', re.I)
def pid(r):
    base = re.sub(r'[^A-Za-z0-9]+', '_', os.path.splitext(r['path'])[0]).strip('_')
    h = hashlib.md5(r['path'].encode()).hexdigest()[:6]
    return (base[-60:] + '_' + h)

def wanted(r):
    if r['license'] != 'Public Domain' or not r['composer'] or not r['midi']: return False
    if (r['style'] or '').lower() in PD_BAD_STYLE: return False
    if not OK_INST.search(r['instrument'] or ''): return False
    return True

rows = [r for r in inv if wanted(r)]
print(len(rows), 'candidates', file=sys.stderr)
only = sys.argv[1] if len(sys.argv) > 1 else None
if only: rows = [r for r in rows if re.search(only, r['path'])]

def run(r):
    i = pid(r)
    d = f'{OUT}/{i}'
    if os.path.exists(d + '/.done'):
        if not RETRY: return (i, 'cached', '')
        try:
            if json.load(open(d + '/.done'))['n'] > 0: return (i, 'cached', '')
        except Exception: pass
    os.makedirs(d, exist_ok=True)
    src = os.path.join(ROOT, r['path'])
    t0 = time.time()
    try:
        p = subprocess.run([LY, '-dno-print-pages', '-dmidi-extension=mid', '--loglevel=ERROR', '-o', f'{d}/out', os.path.basename(src)],
                           cwd=os.path.dirname(src), capture_output=True, text=True, timeout=120)
        mids = [f for f in os.listdir(d) if f.endswith('.mid') or f.endswith('.midi')]
        err = (p.stderr or '')[-400:]
        open(d + '/.done', 'w').write(json.dumps({'rc': p.returncode, 'n': len(mids), 'sec': round(time.time()-t0,1), 'err': err, 'tag': TAG}))
        return (i, 'ok' if mids else 'nomidi', err)
    except subprocess.TimeoutExpired:
        open(d + '/.done', 'w').write(json.dumps({'rc': -9, 'n': 0, 'sec': 120, 'err': 'timeout'}))
        return (i, 'timeout', '')
    except Exception as e:
        return (i, 'error', str(e))

meta = {pid(r): r for r in rows}
json.dump(meta, open(f'{WORK}/meta.json', 'w'), ensure_ascii=False)
done = 0
stat = {}
with ThreadPoolExecutor(4) as ex:
    for i, st, err in ex.map(run, rows):
        stat[st] = stat.get(st, 0) + 1
        done += 1
        if done % 50 == 0: print(done, stat, file=sys.stderr, flush=True)
print('FINAL', stat)
