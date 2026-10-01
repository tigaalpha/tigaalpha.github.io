#!/usr/bin/env python3
"""For the pieces LilyPond could not compile: copy the piece folder, bring the sources up to date with convert-ly, compile with 2.24.3."""
import json, os, re, subprocess, sys, shutil, time, glob
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, MUTOPIA, MIDI, REPO, lilypond_bin_dir
from concurrent.futures import ThreadPoolExecutor
ROOT = MUTOPIA
B = lilypond_bin_dir('v224')
LY, CV = f'{B}/lilypond', f'{B}/convert-ly'
OUT = MIDI; CONV = f'{WORK}/conv'
os.makedirs(CONV, exist_ok=True)
meta = json.load(open(f'{WORK}/meta.json'))
todo = []
for pid, info in meta.items():
    f = f'{OUT}/{pid}/.done'
    if not os.path.exists(f): continue
    j = json.load(open(f))
    if j['n'] == 0 and j.get('tag') != 'conv': todo.append((pid, info))
only = sys.argv[1] if len(sys.argv) > 1 else None
if only: todo = [t for t in todo if re.search(only, t[1]['path'])]
print(len(todo), 'to convert', file=sys.stderr)

def run(item):
    pid, info = item
    src = os.path.join(ROOT, info['path'])
    d = os.path.dirname(src)
    base = d
    if re.search(r'[-_]lys$', os.path.basename(d)): base = os.path.dirname(d)
    rel = os.path.relpath(src, base)
    work = f'{CONV}/{pid}'
    shutil.rmtree(work, ignore_errors=True)
    try:
        shutil.copytree(base, work, symlinks=True, ignore_dangling_symlinks=True, ignore=shutil.ignore_patterns('*.pdf', '*.mid', '*.midi', '.git'))
        files = [os.path.join(dp, f) for dp, dn, fn in os.walk(work) for f in fn if f.endswith(('.ly', '.ily'))]
        for i in range(0, len(files), 40):
            subprocess.run([CV, '-e'] + files[i:i + 40], capture_output=True, text=True, timeout=120)
        outd = f'{OUT}/{pid}'
        for f in os.listdir(outd):
            if f.endswith(('.mid', '.midi')): os.remove(os.path.join(outd, f))
        t0 = time.time()
        p = subprocess.run([LY, '-dno-print-pages', '-dmidi-extension=mid', '--loglevel=ERROR', '-o', f'{outd}/out', rel], cwd=base if False else os.path.dirname(os.path.join(work, rel)) , capture_output=True, text=True, timeout=120)
        mids = [f for f in os.listdir(outd) if f.endswith('.mid')]
        open(f'{outd}/.done', 'w').write(json.dumps({'rc': p.returncode, 'n': len(mids), 'sec': round(time.time() - t0, 1), 'err': (p.stderr or '')[-400:], 'tag': 'conv'}))
        return pid, 'ok' if mids else 'fail'
    except subprocess.TimeoutExpired:
        return pid, 'timeout'
    except Exception as e:
        return pid, 'error ' + str(e)[:60]

stat = {}
with ThreadPoolExecutor(4) as ex:
    for pid, st in ex.map(run, todo):
        stat[st] = stat.get(st, 0) + 1
print(stat)
