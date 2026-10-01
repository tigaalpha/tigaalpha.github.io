#!/usr/bin/env python3
"""Inventory of Mutopia main files: header fields + score/midi presence. Output: inventory.json"""
import os, re, json, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, MUTOPIA
ROOT = sys.argv[1] if len(sys.argv) > 1 else MUTOPIA          # .../mutopia/ftp
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(WORK, 'inventory.json')
INC = re.compile(r'\\include\s+"([^"]+)"')
HDR_FIELD = re.compile(r'^\s*([A-Za-z_]+)\s*=\s*"((?:[^"\\]|\\.)*)"', re.M)

def read(p):
    try:
        with open(p, encoding='utf-8', errors='replace') as f: return f.read()
    except Exception: return ''

def header_text(path, depth=0, seen=None):
    """text of the file plus any included files that hold a \\header (header.ly etc.)"""
    seen = seen or set()
    if path in seen or depth > 3: return ''
    seen.add(path)
    t = read(path)
    out = t
    for m in INC.finditer(t):
        inc = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
        if os.path.isfile(inc) and ('header' in os.path.basename(inc).lower() or 'info' in os.path.basename(inc).lower() or depth == 0):
            out += '\n' + header_text(inc, depth + 1, seen)
    return out

rows = []
for dp, dn, fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith('.ly'): continue
        p = os.path.join(dp, f)
        t = read(p)
        if '\\score' not in t and '\\book' not in t: continue
        ht = header_text(p)
        fields = {}
        for m in HDR_FIELD.finditer(ht):
            k = m.group(1)
            if k not in fields: fields[k] = m.group(2)
        rows.append({
            'path': os.path.relpath(p, ROOT),
            'midi': '\\midi' in t,
            'has_score': '\\score' in t,
            'size': len(t),
            'composer': fields.get('mutopiacomposer', ''),
            'title': fields.get('mutopiatitle', fields.get('title', '')),
            'opus': fields.get('mutopiaopus', fields.get('opus', '')),
            'instrument': fields.get('mutopiainstrument', ''),
            'style': fields.get('style', ''),
            'license': fields.get('license', '') or fields.get('copyright', ''),
            'date': fields.get('date', ''),
            'source': fields.get('source', ''),
        })
json.dump(rows, open(OUT, 'w'), ensure_ascii=False)
print(len(rows), 'main-ish files')
c = collections.Counter(r['license'] for r in rows); print(c.most_common(12))
c = collections.Counter(r['instrument'] for r in rows); print(c.most_common(30))
c = collections.Counter(r['style'] for r in rows); print(c.most_common(12))
print('midi blocks:', sum(1 for r in rows if r['midi']), 'no header composer:', sum(1 for r in rows if not r['composer']))
