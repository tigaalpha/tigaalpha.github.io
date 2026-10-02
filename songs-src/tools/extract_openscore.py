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
    # the Impressionist songs (Mutopia has almost none)
    'Debussy,_Claude': 'DebussyC',
    'Satie,_Erik': 'SatieE',
    'Boulanger,_Lili': 'BoulangerL',
    'Delius,_Frederick': 'DeliusF',
    'Chausson,_Ernest': 'ChaussonE',
    # the great song composers of the 19th century (only those who died in 1929 or earlier: every song of theirs is old enough)
    'Brahms,_Johannes': 'BrahmsJ', 'Schubert,_Franz': 'SchubertF', 'Schumann,_Robert': 'SchumannR', 'Schumann,_Clara': 'SchumannC',
    'Mendelssohn,_Felix': 'MendelssohnF', 'Hensel,_Fanny': 'HenselF', 'Franz,_Robert': 'FranzR', 'Wolf,_Hugo': 'WolfH', 'Mahler,_Gustav': 'MahlerG',
    'Cornelius,_Peter': 'CorneliusP', 'Lang,_Josephine': 'LangJ', 'Kinkel,_Johanna': 'KinkelJ', 'Reichardt,_Louise': 'ReichardtL',
    'Zumsteeg,_Emilie': 'ZumsteegE', 'Mayer,_Emilie': 'MayerE', 'Wagner,_Richard': 'WagnerR', 'Berlioz,_Hector': 'BerliozH',
    'Chopin,_Frédéric': 'ChopinFF', 'Liszt,_Franz': 'LisztF', 'Verdi,_Giuseppe': 'VerdiG', 'Rossini,_Gioachino': 'RossiniG',
    'Fauré,_Gabriel': 'FaureG', 'Bizet,_Georges': 'BizetG', 'Gounod,_Charles': 'GounodC', 'Chabrier,_Emmanuel': 'ChabrierEA',
    'Massenet,_Jules': 'MassenetJ', 'Holmès,_Augusta_Mary_Anne': 'HolmesA', 'Viardot,_Pauline': 'ViardotP', 'Jaëll,_Marie': 'JaellM',
    'Grandval,_Clémence_de': 'GrandvalC', 'Paladilhe,_Émile': 'PaladilheE', 'Flégier,_Ange': 'FlegierA', 'Ferrari,_Gabrielle': 'FerrariG',
    'Farrenc,_Louise': 'FarrencL', 'Duchambge,_Pauline': 'DuchambgeP', 'Puget,_Loïsa': 'PugetL', 'Thys,_Pauline': 'ThysP',
    'Lehmann,_Liza': 'LehmannL', 'Stanford,_Charles_Villiers': 'StanfordC', 'Parry,_Hubert': 'ParryH', 'Parratt,_Walter': 'ParrattW',
    'Sullivan,_Arthur': 'SullivanA', 'Barnby,_Joseph': 'BarnbyJ', 'Bishop,_Henry': 'BishopH', 'Cellier,_Alfred': 'CellierA',
    'Butterworth,_George': 'ButterworthG', 'Coleridge-Taylor,_Samuel': 'ColeridgeTaylorS', 'Barnard,_Charlotte_Alington': 'BarnardC',
    'Dickson,_Ellen': 'DicksonE', 'Hodges,_Faustina_Hasse': 'HodgesF', 'Marshall,_Florence_Ashton': 'MarshallF', 'Wood,_Charles': 'WoodC',
    'Mounsey_Bartholomew,_Ann': 'MounseyA', 'Munktell,_Helena': 'MunktellH', 'Netzel,_Laura': 'NetzelL', 'Le_Beau,_Luise_Adolpha': 'LeBeauL',
    'Gabriel,_Virginia': 'GabrielV', 'Tosti,_Francesco_Paolo': 'TostiF', 'Leoncavallo,_Ruggero': 'LeoncavalloR', 'Donaudy,_Stefano': 'DonaudyS',
    'Liliuokalani,_Queen_of_the_Hawaiian_Islands': 'LiliuokalaniQ', 'Joplin,_Scott': 'JoplinS',
    # the 18th century and earlier
    'Beethoven,_Ludwig_van': 'BeethovenLv', 'Haydn,_Joseph': 'HaydnFJ', 'Paradis,_Maria_Theresia_von': 'ParadisM', 'Schröter,_Corona': 'SchroterC',
    'Arne,_Thomas': 'ArneT', 'Gail,_Sophie': 'GailS', 'Abrams,_Harriett': 'AbramsH', 'Gambarini,_Elisabetta_de': 'GambariniE',
    'Shield,_William': 'ShieldW', 'Guest,_Jane_Mary': 'GuestJ',
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
