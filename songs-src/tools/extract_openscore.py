#!/usr/bin/env python3
"""OpenScore Lieder (MusicXML, CC0) -> candidate tunes, the same shape as extract.py writes for Mutopia:  $SONGS_WORK/cands-os.json

  python3 extract_openscore.py                 # the composers listed in COMPOSERS below
  python3 extract_openscore.py Debussy Satie   # only folders whose name contains one of the words

Needs the corpus in $SONGS_WORK/openscore (see README.md); assemble.py picks cands-os.json up next to cands.json.
The tune of a song is its vocal line (the part that is not the piano), read by musicxml.py and cut, quantised and folded by
extract.analyze() exactly like a Mutopia score.  OpenScore's scores are transcriptions of public-domain editions (IMSLP) released
under CC0, so there is nothing to credit; `src` still records the file."""
import os, re, sys, json, hashlib, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK
import extract as ex
import musicxml

CORPUS = os.path.join(WORK, 'openscore', 'scores')
# folder name in the corpus -> composer code in extract.COMP (the era, dates and Thai/Chinese names live there)
COMPOSERS = {
    'Debussy,_Claude': 'DebussyC',
    'Satie,_Erik': 'SatieE',
    'Boulanger,_Lili': 'BoulangerL',
    'Delius,_Frederick': 'DeliusF',
    'Chausson,_Ernest': 'ChaussonE',
    'Fauré,_Gabriel': 'FaureG',
}


def instrument_of(names):
    low = [n.lower() for n in names]
    if len(names) >= 2 and any('piano' in n for n in low) and any('piano' not in n for n in low): return 'Voice and Piano'
    return ', '.join(n.replace('\n', ' ') for n in names) or 'Voice'


def main():
    words = [w.lower() for w in sys.argv[1:]]
    out = []; stat = collections.Counter()
    for folder, code in COMPOSERS.items():
        if words and not any(w in folder.lower() for w in words): continue
        root = os.path.join(CORPUS, folder)
        if not os.path.isdir(root): print('missing', root); continue
        for dp, dn, fn in sorted(os.walk(root)):
            for f in sorted(fn):
                if not f.endswith('.mxl'): continue
                path = os.path.join(dp, f)
                rel = os.path.relpath(path, CORPUS)
                pid = 'os_' + hashlib.md5(rel.encode()).hexdigest()[:10]
                try:
                    root_xml = musicxml._root(path)
                    names = [(sp.findtext('part-name') or '').strip() for sp in root_xml.iter('score-part')]
                    work = (root_xml.findtext('work/work-title') or '').strip()
                    mov = (root_xml.findtext('movement-title') or '').strip()
                except Exception as e:
                    stat['unreadable'] += 1; continue
                info = {'path': 'openscore:scores/' + rel, 'composer': code, 'title': mov or work, 'opus': work if mov and work != mov else '',
                        'instrument': instrument_of(names), 'style': 'song', 'date': '', 'source': 'OpenScore Lieder (CC0)'}
                r = ex.process_xml(pid, info, path)
                r['mid'] = f
                r['info'] = info
                out.append(r)
                stat['ok' if r['ok'] else 'fail: ' + re.sub(r'[\d.]+', '#', r['why'])[:40]] += 1
    json.dump(out, open(os.path.join(WORK, 'cands-os.json'), 'w'), ensure_ascii=False)
    for k, v in stat.most_common(): print(f'{v:5d}  {k}')
    print(len(out), 'results')


if __name__ == '__main__':
    main()
