#!/usr/bin/env python3
"""MIDI (compiled from a Mutopia LilyPond source) -> one Play Along "tune" in the songs-src JSON format.

  python3 songs-src/tools/extract.py            # every compiled Mutopia piece -> $SONGS_WORK/cands.json + a count of why pieces dropped out
  python3 songs-src/tools/extract.py ID_REGEX   # a subset

The tune is the top voice of the right hand (or the one melodic instrument), reduced to one note at a time, cut at a
natural cadence on a bar line, folded into C4..B5 and slowed to a playable tempo.  Nothing is guessed: every note
comes from the typeset public-domain score."""
import json, os, re, sys, math, collections, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import WORK, MUTOPIA, MIDI

ROOT = MUTOPIA
meta = json.load(open(f'{WORK}/meta.json')) if os.path.exists(f'{WORK}/meta.json') else {}      # the Mutopia scores (compile_all.py); empty when only OpenScore is used

# Mutopia composer code -> display
COMP = {
 # code: (short, full, died, era, th, zh)
 'BachJS': ('Bach', 'J.S. Bach', 1750, 'baroque', 'บาค', '巴赫'),
 'BachCPE': ('C.P.E. Bach', 'C.P.E. Bach', 1788, 'classical', 'ซี.พี.อี. บาค', 'C.P.E.巴赫'),
 'HandelGF': ('Handel', 'G.F. Handel', 1759, 'baroque', 'ฮันเดล', '亨德尔'),
 'TelemannGP': ('Telemann', 'G.P. Telemann', 1767, 'baroque', 'เทเลมันน์', '泰勒曼'),
 'ScarlattiD': ('D. Scarlatti', 'D. Scarlatti', 1757, 'baroque', 'สการ์ลัตติ', '斯卡拉蒂'),
 'PurcellH': ('Purcell', 'H. Purcell', 1695, 'baroque', 'เพอร์เซลล์', '珀塞尔'),
 'RameauJP': ('Rameau', 'J.P. Rameau', 1764, 'baroque', 'ราโม', '拉莫'),
 'BuxtehudeD': ('Buxtehude', 'D. Buxtehude', 1707, 'baroque', 'บุกซ์เทอูเดอ', '布克斯特胡德'),
 'DandrieuJ': ('Dandrieu', 'J. Dandrieu', 1740, 'baroque', 'ดองดริเยอ', '当德里厄'),
 'CorelliA': ('Corelli', 'A. Corelli', 1713, 'baroque', 'คอเรลลี', '柯莱利'),
 'VivaldiA': ('Vivaldi', 'A. Vivaldi', 1741, 'baroque', 'วิวัลดี', '维瓦尔第'),
 'CouperinF': ('Couperin', 'F. Couperin', 1733, 'baroque', 'กูเปอแร็ง', '库普兰'),
 'PachelbelJ': ('Pachelbel', 'J. Pachelbel', 1706, 'baroque', 'พาเคลเบล', '帕赫贝尔'),
 'LullyJB': ('Lully', 'J.B. Lully', 1687, 'baroque', 'ลูลลี', '吕利'),
 'MozartWA': ('Mozart', 'W.A. Mozart', 1791, 'classical', 'โมสาร์ท', '莫扎特'),
 'HaydnFJ': ('Haydn', 'F.J. Haydn', 1809, 'classical', 'ไฮเดิน', '海顿'),
 'BeethovenLv': ('Beethoven', 'L. van Beethoven', 1827, 'classical', 'เบโธเฟน', '贝多芬'),
 'ClementiM': ('Clementi', 'M. Clementi', 1832, 'classical', 'เคลเมนติ', '克莱门蒂'),
 'KuhlauF': ('Kuhlau', 'F. Kuhlau', 1832, 'classical', 'คูเลา', '库劳'),
 'DiabelliA': ('Diabelli', 'A. Diabelli', 1858, 'classical', 'ดิอาเบลลี', '迪亚贝利'),
 'DussekJL': ('Dussek', 'J.L. Dussek', 1812, 'classical', 'ดูเซก', '杜舍克'),
 'RiesF': ('Ries', 'F. Ries', 1838, 'classical', 'รีส', '里斯'),
 'ChopinFF': ('Chopin', 'F. Chopin', 1849, 'romantic', 'โชแปง', '肖邦'),
 'SchubertF': ('Schubert', 'F. Schubert', 1828, 'romantic', 'ชูเบิร์ต', '舒伯特'),
 'SchumannR': ('Schumann', 'R. Schumann', 1856, 'romantic', 'ชูมันน์', '舒曼'),
 'MendelssohnF': ('Mendelssohn', 'F. Mendelssohn', 1847, 'romantic', 'เมเดลส์โซน', '门德尔松'),
 'Mendelssohn-BartholdyF': ('Mendelssohn', 'F. Mendelssohn', 1847, 'romantic', 'เมเดลส์โซน', '门德尔松'),
 'LisztF': ('Liszt', 'F. Liszt', 1886, 'romantic', 'ลิสต์', '李斯特'),
 'BrahmsJ': ('Brahms', 'J. Brahms', 1897, 'romantic', 'บรามส์', '勃拉姆斯'),
 'TchaikovskyPI': ('Tchaikovsky', 'P.I. Tchaikovsky', 1893, 'romantic', 'ไชคอฟสกี', '柴可夫斯基'),
 'DvorakA': ('Dvořák', 'A. Dvořák', 1904, 'romantic', 'ดโวชาก', '德沃夏克'),
 'GriegE': ('Grieg', 'E. Grieg', 1907, 'romantic', 'กริก', '格里格'),
 'VerdiG': ('Verdi', 'G. Verdi', 1901, 'romantic', 'แวร์ดี', '威尔第'),
 'RossiniG': ('Rossini', 'G. Rossini', 1868, 'romantic', 'รอสซินี', '罗西尼'),
 'DonizettiG': ('Donizetti', 'G. Donizetti', 1848, 'romantic', 'โดนิเซตติ', '多尼采蒂'),
 'BizetG': ('Bizet', 'G. Bizet', 1875, 'romantic', 'บีเซต์', '比才'),
 'GounodC': ('Gounod', 'C. Gounod', 1893, 'romantic', 'กูนอด', '古诺'),
 'FranckC': ('Franck', 'C. Franck', 1890, 'romantic', 'ฟรังก์', '弗朗克'),
 'Saint-SaensC': ('Saint-Saëns', 'C. Saint-Saëns', 1921, 'romantic', 'แซงต์-ซองส์', '圣-桑'),
 'FaureG': ('Fauré', 'G. Fauré', 1924, 'romantic', 'โฟเร', '福雷'),
 'MussorgskyM': ('Mussorgsky', 'M. Mussorgsky', 1881, 'romantic', 'มุสซอร์กสกี', '穆索尔斯基'),
 'Rimsky-KorsakovN': ('Rimsky-Korsakov', 'N. Rimsky-Korsakov', 1908, 'romantic', 'ริมสกี-คอร์ซาคอฟ', '里姆斯基-科萨科夫'),
 'GlazunovA': ('Glazunov', 'A. Glazunov', 1936, 'romantic', 'กลาซูนอฟ', '格拉祖诺夫'),
 'BurgmullerJFF': ('Burgmüller', 'F. Burgmüller', 1874, 'romantic', 'เบิร์กมึลเลอร์', '布格缪勒'),
 'CzernyC': ('Czerny', 'C. Czerny', 1857, 'romantic', 'เชอร์นี', '车尔尼'),
 'ElgarE': ('Elgar', 'E. Elgar', 1934, 'romantic', 'เอลการ์', '埃尔加'),
 'HolstGT': ('Holst', 'G. Holst', 1934, 'romantic', 'โฮลสต์', '霍尔斯特'),
 'RegerM': ('Reger', 'M. Reger', 1916, 'romantic', 'เรเกอร์', '雷格'),
 'ScriabinA': ('Scriabin', 'A. Scriabin', 1915, 'romantic', 'สคริอาบิน', '斯克里亚宾'),
 'RachmaninoffS': ('Rachmaninoff', 'S. Rachmaninoff', 1943, 'romantic', 'ราห์มานินอฟ', '拉赫玛尼诺夫'),
 'StraussJJ': ('J. Strauss II', 'J. Strauss II', 1899, 'romantic', 'โยฮันน์ สเตราส์ที่ 2', '小约翰·施特劳斯'),
 'FosterSC': ('Foster', 'S. Foster', 1864, 'romantic', 'ฟอสเตอร์', '福斯特'),
 'AbtF': ('Abt', 'F. Abt', 1885, 'romantic', 'อับท์', '阿布特'),
 'AdamA': ('Adam', 'A. Adam', 1856, 'romantic', 'อดัม', '阿当'),
 'MinkusLA': ('Minkus', 'L. Minkus', 1917, 'romantic', 'มินคุส', '明库斯'),
 'PaganiniN': ('Paganini', 'N. Paganini', 1840, 'romantic', 'ปากานีนี', '帕格尼尼'),
 'TarregaF': ('Tárrega', 'F. Tárrega', 1909, 'romantic', 'ตาร์เรกา', '塔雷加'),
 'CarcassiM': ('Carcassi', 'M. Carcassi', 1853, 'romantic', 'คาร์กัสซี', '卡尔卡西'),
 'SorF': ('Sor', 'F. Sor', 1839, 'classical', 'ซอร์', '索尔'),
 'GiulianiM': ('Giuliani', 'M. Giuliani', 1829, 'classical', 'จูลีอานี', '朱利亚尼'),
 'AguadoD': ('Aguado', 'D. Aguado', 1849, 'romantic', 'อากวาโด', '阿瓜多'),
 'DebussyC': ('Debussy', 'C. Debussy', 1918, 'impressionism', 'เดอบูว์ซี', '德彪西'),
 'SatieE': ('Satie', 'E. Satie', 1925, 'impressionism', 'ซาตี', '萨蒂'),
 'BoulangerL': ('L. Boulanger', 'L. Boulanger', 1918, 'impressionism', 'ลีลี บูล็องเฌร์', '莉莉·布朗热'),
 'DeliusF': ('Delius', 'F. Delius', 1934, 'impressionism', 'ดีเลียส', '戴留斯'),
 'ChaussonE': ('Chausson', 'E. Chausson', 1899, 'romantic', 'โชซง', '肖松'),
 'DukasP': ('Dukas', 'P. Dukas', 1935, 'impressionism', 'ดูกาส์', '杜卡'),
 'ChabrierEA': ('Chabrier', 'E. Chabrier', 1894, 'romantic', 'ชาบรีเยร์', '夏布里埃'),
 'NielsenCA': ('Nielsen', 'C. Nielsen', 1931, 'romantic', 'นีลเส็น', '尼尔森'),
 'BruchM': ('Bruch', 'M. Bruch', 1920, 'romantic', 'บรุค', '布鲁赫'),
 'JoplinS': ('Joplin', 'S. Joplin', 1917, 'romantic', 'จอปลิน', '乔普林'),
 'SousaJP': ('Sousa', 'J.P. Sousa', 1932, 'romantic', 'ซูซา', '苏萨'),
 'AlkanCV': ('Alkan', 'C.V. Alkan', 1888, 'romantic', 'อัลกอง', '阿尔康'),
 'FieldJ': ('Field', 'J. Field', 1837, 'romantic', 'ฟีลด์', '菲尔德'),
 'GranadosE': ('Granados', 'E. Granados', 1916, 'romantic', 'กรานาดอส', '格拉纳多斯'),
 'AlbenizIMF': ('Albéniz', 'I. Albéniz', 1909, 'romantic', 'อัลเบนิซ', '阿尔贝尼兹'),
 'HumperdinckE': ('Humperdinck', 'E. Humperdinck', 1921, 'romantic', 'ฮุมเปอร์ดิงค์', '洪佩尔丁克'),
 'WidorC': ('Widor', 'C. Widor', 1937, 'romantic', 'วิดอร์', '维多'),
 'GossecFJ': ('Gossec', 'F.J. Gossec', 1829, 'classical', 'โกสแซก', '戈塞克'),
}

NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def note_name(m): return f'{NOTE_NAMES_SHARP[m % 12]}{m // 12 - 1}'
MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']
KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

def corr(a, b):
    ma, mb = sum(a) / 12, sum(b) / 12
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return num / den if den else 0

def best_key(weights):
    best = (-9, None, None)
    for t in range(12):
        rot = [weights[(t + i) % 12] for i in range(12)]
        for mode, prof in (('maj', KS_MAJ), ('min', KS_MIN)):
            c = corr(rot, prof)
            if c > best[0]: best = (c, t, mode)
    return best  # (corr, tonic pc, mode)

def diatonic_ratio(pcs_weighted, tonic, mode):
    degs = [0, 2, 4, 5, 7, 9, 11] if mode == 'maj' else [0, 2, 3, 5, 7, 8, 9, 10, 11]
    s = {(tonic + d) % 12 for d in degs}
    tot = sum(pcs_weighted); ins = sum(w for pc, w in enumerate(pcs_weighted) if pc in s)
    return ins / tot if tot else 0

# how long a song is meant to be: the excerpt is chosen so that it plays for about TARGET_SEC at the playable tempo (what the
# app will use, not the score's own), ends on a cadence, and never runs past MAX_SEC (the existing hand-made songs run 10-35 s)
TARGET_SEC = 24
MIN_SEC, MAX_SEC = 15, 75

KEYSIG_NAME = {'C': (0, 'maj'), 'G': (7, 'maj'), 'D': (2, 'maj'), 'A': (9, 'maj'), 'E': (4, 'maj'), 'B': (11, 'maj'), 'F#': (6, 'maj'), 'C#': (1, 'maj'),
               'F': (5, 'maj'), 'Bb': (10, 'maj'), 'Eb': (3, 'maj'), 'Ab': (8, 'maj'), 'Db': (1, 'maj'), 'Gb': (6, 'maj'), 'Cb': (11, 'maj'),
               'Am': (9, 'min'), 'Em': (4, 'min'), 'Bm': (11, 'min'), 'F#m': (6, 'min'), 'C#m': (1, 'min'), 'G#m': (8, 'min'), 'D#m': (3, 'min'), 'A#m': (10, 'min'),
               'Dm': (2, 'min'), 'Gm': (7, 'min'), 'Cm': (0, 'min'), 'Fm': (5, 'min'), 'Bbm': (10, 'min'), 'Ebm': (3, 'min'), 'Abm': (8, 'min')}

def key_name(tonic, mode):
    return MAJOR_NAMES[tonic % 12] if mode == 'maj' else MINOR_NAMES[tonic % 12]

# ── the score's source text: pickup and tempo hints ──
INC = re.compile(r'\\include\s+"([^"]+)"')
def source_texts(path, depth=0, seen=None):
    seen = seen if seen is not None else set()
    if path in seen or depth > 3: return ''
    seen.add(path)
    try: t = open(path, encoding='utf-8', errors='replace').read()
    except Exception: return ''
    out = t
    for m in INC.finditer(t):
        inc = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
        if os.path.isfile(inc): out += '\n' + source_texts(inc, depth + 1, seen)
    return out

PARTIAL = re.compile(r'\\partial\s+(\d+)(\.*)(?:\s*\*\s*(\d+)(?:\s*/\s*(\d+))?)?')
def partial_beats(text):
    m = PARTIAL.search(text)
    if not m: return 0.0
    den = int(m.group(1)); dots = len(m.group(2)); mult = int(m.group(3) or 1)
    if m.group(4): mult = mult / int(m.group(4))
    if den == 0: return 0.0
    beats = 4.0 / den * (2 - 0.5 ** dots) * mult
    return beats

TEMPO_WORDS = [('larghissimo', 40), ('grave', 44), ('largo', 52), ('lento', 56), ('adagio', 62), ('larghetto', 66), ('andante', 80), ('andantino', 88), ('moderato', 100),
               ('allegretto', 108), ('allegro', 120), ('vivace', 132), ('presto', 140), ('prestissimo', 150)]
def tempo_hint(text):
    m = re.search(r'\\tempo\s+(?:"[^"]*"\s+)?(\d+)(\.?)\s*=\s*(\d+)', text)
    if m:
        den = int(m.group(1)); dotted = bool(m.group(2)); bpm = int(m.group(3))
        qb = bpm * (4.0 / den) * (1.5 if dotted else 1)       # quarter-notes per minute
        return qb
    low = text.lower()
    best = None
    for w, b in TEMPO_WORDS:
        i = low.find(w)
        if i >= 0 and (best is None or i < best[0]): best = (i, b)
    return best[1] if best else None

def _varint(b, i):
    v = 0
    while True:
        c = b[i]; i += 1
        v = (v << 7) | (c & 0x7F)
        if not (c & 0x80): return v, i

KEYS_MAJ = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
KEYS_MIN = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']
def read_midi(path):
    """A small standard-MIDI-file reader (mido refuses the odd key signatures LilyPond writes for keys with 8+ sharps)."""
    b = open(path, 'rb').read()
    assert b[:4] == b'MThd'
    hl = int.from_bytes(b[4:8], 'big'); ntr = int.from_bytes(b[10:12], 'big'); tpq = int.from_bytes(b[12:14], 'big')
    i = 8 + hl
    tracks = []; tsigs = []; ksigs = []; tempos = []
    for _ in range(ntr):
        if b[i:i + 4] != b'MTrk': break
        ln = int.from_bytes(b[i + 4:i + 8], 'big'); j = i + 8; end = j + ln; i = end
        t = 0; name = ''; active = {}; notes = []; run = 0
        while j < end:
            dt, j = _varint(b, j); t += dt
            st = b[j]
            if st < 0x80: st = run                      # running status
            else: j += 1
            if st == 0xFF:
                typ = b[j]; j += 1
                ln2, j = _varint(b, j); data = b[j:j + ln2]; j += ln2
                if typ == 0x03: name = data.decode('latin-1', 'replace')
                elif typ == 0x58 and len(data) >= 2: tsigs.append((t, data[0], 1 << data[1]))
                elif typ == 0x59 and len(data) >= 2:
                    sf = data[0] - 256 if data[0] > 127 else data[0]; mi = data[1]
                    idx = sf + 7
                    ksigs.append((t, (KEYS_MIN if mi else KEYS_MAJ)[idx] if 0 <= idx < 15 else 'C'))
                elif typ == 0x51 and len(data) == 3: tempos.append((t, int.from_bytes(data, 'big')))
            elif st in (0xF0, 0xF7):
                ln2, j = _varint(b, j); j += ln2
            else:
                run = st
                kind = st & 0xF0; ch = st & 0x0F
                if kind in (0xC0, 0xD0): j += 1
                else:
                    d1, d2 = b[j], b[j + 1]; j += 2
                    if kind == 0x90 and d2 > 0: active.setdefault((ch, d1), []).append(t)
                    elif kind == 0x80 or (kind == 0x90 and d2 == 0):
                        lst = active.get((ch, d1))
                        if lst: notes.append((lst.pop(0), t, d1))
        notes.sort()
        tracks.append({'name': name, 'notes': notes})
    return tpq, tracks, sorted(tsigs), sorted(ksigs), sorted(tempos)

VOICE_RE = re.compile(r'voice|vocal|sing|melod|canto|sopr|mezz|alto|tenor|baritone|solo|lead|cantus|song|gesang|stimme|chant|violin ?i\b|violino ?(1|i)\b|violin ?1|vln ?1|vl\.? ?1|violine ?1|oboe|flute|flauto|cello|violoncello|guitar|upper|right|treble|rh|manual|clavier|piano ?1', re.I)

def pick_track(tracks, inst):
    cand = [t for t in tracks if len(t['notes']) >= 8]
    if not cand: return None, 'no tracks'
    il = (inst or '').lower()
    if len(cand) == 1: return cand[0], ''
    mean = lambda t: sum(n[2] for n in t['notes']) / len(t['notes'])
    mx = max(len(t['notes']) for t in cand)
    if 'voice' in il and ('piano' in il or 'organ' in il or 'harp' in il):
        pianoish = re.compile(r'upper|lower|treble|^bass|piano|^rh|^lh|clavier|left|right|pedal|continuo|basso|accomp|keyboard|manual', re.I)
        vt = [t for t in cand if not pianoish.search(t['name'] or '')]
        named = [t for t in vt if re.search(r'voice|vocal|sing|melod|canto|sopr|mezz|alto|tenor|baritone|solo|lead|cantus|song|gesang|stimme|chant', t['name'] or '', re.I)]
        if len(named) == 1: return named[0], ''
        if len(vt) == 1: return vt[0], ''
        return None, 'voice track unclear: ' + ','.join(t['name'] for t in cand)
    big = [t for t in cand if len(t['notes']) >= 0.4 * mx]
    return max(big, key=mean), ''

def skyline(notes, limit_tick):
    notes = [n for n in notes if n[0] < limit_tick]
    mel = []; active = []; i = 0; n = len(notes)
    while i < n:
        t = notes[i][0]; group = []
        while i < n and notes[i][0] == t: group.append(notes[i]); i += 1
        active = [a for a in active if a[1] > t]
        held_top = max((a[2] for a in active), default=-1)
        top = max(group, key=lambda x: (x[2], x[1] - x[0]))
        if top[2] >= held_top: mel.append([t, top[1], top[2]])
        active.extend(group)
    for k in range(len(mel) - 1):
        if mel[k][1] > mel[k + 1][0]: mel[k][1] = mel[k + 1][0]
    return mel

def fmt(x):
    s = ('%.2f' % x).rstrip('0').rstrip('.')
    return s

def build_bars(notes, S, pickup, bar, nb, lead_rest=0.0):
    """notes: [start, end, pitch] in beats (end already cut at the song's end); S: where the first bar starts.
    Returns the bar strings, or None when a bar would hold no token (a note longer than a whole bar)."""
    start_full = S + pickup if pickup else S
    bounds = []                                   # the END of every bar
    if pickup: bounds.append(S + pickup)
    for j in range(nb): bounds.append(start_full + (j + 1) * bar)
    total_end = bounds[-1]
    items = []
    t = S
    if lead_rest > 1e-9: items.append(('R', S, S + lead_rest)); t = S + lead_rest
    for s_, e_, p in notes:
        if s_ > t + 1e-9: items.append(('R', t, s_))
        items.append((p, s_, e_)); t = e_
    if t < total_end - 1e-9: items.append(('R', t, total_end))
    toks = [[] for _ in bounds]
    for what, s_, e_ in items:
        if what == 'R':
            # a rest is cut at every bar line
            cur = s_
            while cur < e_ - 1e-9:
                b = 0
                while b < len(bounds) - 1 and cur >= bounds[b] - 1e-9: b += 1
                seg_end = min(e_, bounds[b])
                toks[b].append(f'R:{fmt(seg_end - cur)}'); cur = seg_end
        else:
            b = 0
            while b < len(bounds) - 1 and s_ >= bounds[b] - 1e-9: b += 1
            toks[b].append(f'{note_name(what)}:{fmt(e_ - s_)}')
    if any(not x for x in toks): return None
    return [' '.join(x) for x in toks]

def pitch_stats(mel):
    return min(m[2] for m in mel), max(m[2] for m in mel)

def process(pid, info):
    d = f'{MIDI}/{pid}'
    mids = sorted(f for f in os.listdir(d) if f.endswith('.mid') or f.endswith('.midi')) if os.path.isdir(d) else []
    out = []
    src_path = os.path.join(ROOT, info['path'])
    text = source_texts(src_path)
    for mi, fn in enumerate(mids):
        r = process_one(pid, info, os.path.join(d, fn), text, mi, len(mids))
        r['mid'] = fn
        out.append(r)
    return out

def process_one(pid, info, path, text, mi, nmid):
    R = {'pid': pid, 'ok': False, 'why': ''}
    try:
        tpq, tracks, tsigs, ksigs, tempos = read_midi(path)
    except Exception as e:
        R['why'] = 'midi: ' + str(e)[:60]; return R
    return analyze(R, info, tpq, tracks, tsigs, ksigs, tempos, text, partial_beats(text))

def process_xml(pid, info, path):
    """the same, for a MusicXML score (OpenScore): the pickup comes from the short first measure instead of LilyPond's \\partial"""
    import musicxml
    R = {'pid': pid, 'ok': False, 'why': ''}
    try:
        tpq, tracks, tsigs, ksigs, tempos, xi = musicxml.read_mxl(path)
    except Exception as e:
        R['why'] = 'musicxml: ' + str(e)[:60]; return R
    if xi['irregular_meter']: R['why'] = 'irregular meter'; return R
    R['xml'] = {k: xi[k] for k in ('work', 'movement', 'composer', 'pickup')}
    return analyze(R, info, tpq, tracks, tsigs, ksigs, tempos, '', xi['pickup'])

def analyze(R, info, tpq, tracks, tsigs, ksigs, tempos, text, part_beats):
    """the notes of one score -> one tune (bars, bpm, key ...); shared by the MIDI and the MusicXML sources.
    `text` is the LilyPond source (for a tempo word when the MIDI has no tempo), `part_beats` the beats of the pickup bar."""
    tr, why = pick_track(tracks, info['instrument'])
    if not tr: R['why'] = why; return R
    ts0 = tsigs[0] if tsigs else (0, 4, 4)
    num, den = ts0[1], ts0[2]
    scale = 1.0
    total = num * 4.0 / den                                   # the written bar, in quarter notes
    if total in (2.0, 3.0, 4.0): bar = total                  # 2/4 3/4 4/4, 2/2, 4/8, 6/8 (eighths = 0.5)
    elif total in (1.0, 1.5): bar = total * 2; scale = 2.0    # 2/8, 3/8: every note value doubled
    elif total in (6.0, 8.0): bar = total / 2                 # 6/4, 3/2, 12/8, 4/2: two of our bars to the written one
    else: R['why'] = f'meter {num}/{den}'; return R
    meter = f'{int(bar)}/4'
    if len([t for t in tsigs if t[0] > 0 and (t[1], t[2]) != (num, den)]) > 0:
        # a change later on: only the opening matters, checked again when the excerpt is cut
        pass
    first_change = min([t[0] for t in tsigs if t[0] > 0 and (t[1], t[2]) != (num, den)], default=None)
    # tempo
    named = [t for t in tempos if t[1] != 1000000]
    real_q = 60e6 / named[0][1] if named else None            # quarter notes per minute from the MIDI
    hint = tempo_hint(text)
    qbpm = real_q or hint or 84.0
    qbpm_src = 'midi' if real_q else ('text' if hint else 'default')
    # the melody (limit the work to the first ~100 bars)
    mel = skyline(tr['notes'], limit_tick=int(100 * bar / scale * tpq))
    if len(mel) < 12: R['why'] = 'melody too short'; return R
    # in beats of OUR unit (a quarter note = 1 beat, x scale for the eighth-note meters); the grid of sixteenths runs from the
    # bar line, which is where the source's \partial puts it (a score that starts with a 32nd pickup sits 0.125 off zero)
    part = part_beats * scale
    phase = part % bar if part else 0.0
    # a grace note at the very start of a score moves the whole timeline by its length (LilyPond has no earlier note to take the
    # time from): find the shift, a multiple of 1/16 beat, that puts the notes back on the sixteenth-note grid, and move the
    # bar lines with it
    def grid_err(dl):
        e_ = 0.0
        for s_, e2, p in mel[:60]:
            sb = s_ / tpq * scale - phase - dl
            e_ += abs(sb * 4 - round(sb * 4))
        return e_
    base_err = grid_err(0.0)
    delta = 0.0
    if base_err > 1.0:
        cand_d = [(grid_err(d_), d_) for d_ in (0.0625, 0.125, 0.1875)]
        best_e, best_d = min(cand_d)
        if best_e < 0.6 * base_err: delta = best_d
    phase = (phase + delta) % bar
    R['delta'] = delta
    gq = lambda x: phase + round((x - phase) * 4) / 4
    mb = []
    off = 0
    for s_, e_, p in mel:
        sb, eb = s_ / tpq * scale, e_ / tpq * scale
        if eb - sb < 0.125 - 1e-6: continue
        if abs((sb - phase) * 4 - round((sb - phase) * 4)) > 0.12 or abs((eb - sb) * 4 - round((eb - sb) * 4)) > 0.12: off += 1
        qs, qe = gq(sb), gq(eb)
        if qe <= qs + 1e-9: continue
        mb.append([qs, qe, p])
    for k in range(len(mb) - 1):
        if mb[k][1] > mb[k + 1][0]: mb[k][1] = mb[k + 1][0]
    mb = [m for m in mb if m[1] - m[0] >= 0.25 - 1e-9]
    if len(mb) < 12: R['why'] = 'melody too short after quantising'; return R
    R['offgrid'] = round(off / max(1, len(mel)), 3)
    if R['offgrid'] > 0.3: R['why'] = f'tuplets/odd rhythm ({R["offgrid"]})'; return R
    # pickup: the source's \partial, else the bar lines fall on whole bars from the start
    # an intro that is the same bar three times running is the accompaniment figure, not the tune: start after it
    def bar_sig(idx):
        lo = phase + idx * bar; hi = lo + bar
        return tuple((p, round(s_ - lo, 3), round(e_ - s_, 3)) for s_, e_, p in mb if lo - 1e-9 <= s_ < hi - 1e-9)
    i0 = int(math.floor((mb[0][0] - phase) / bar + 1e-9))
    guard = 0
    while guard < 80:
        guard += 1
        s0 = bar_sig(i0)
        if not s0:
            i0 += 1; continue
        if s0 == bar_sig(i0 + 1) == bar_sig(i0 + 2):
            j = i0
            while bar_sig(j) == s0: j += 1
            i0 = j; continue
        break
    cut = phase + i0 * bar
    if cut > mb[0][0] + 1e-9 or i0 > int(math.floor((mb[0][0] - phase) / bar + 1e-9)):
        mb = [m for m in mb if m[0] >= cut - 1e-9]
        R['intro_skipped'] = True
    if len(mb) < 12: R['why'] = 'melody too short after the intro'; return R
    mb_all = mb
    # the tune may not begin with the piece: when the opening cannot be played (an outlier note, a leap of three octaves) the
    # excerpt starts at a later bar — the first one that gives a good window
    starts = []
    seen_b = set()
    for m in mb_all:
        bi = int(math.floor((m[0] - phase) / bar + 1e-9))
        if bi not in seen_b: seen_b.add(bi); starts.append(bi)
    starts = starts[:14]
    def build_for(mb):
        if len(mb) < 12: return 'melody too short after the intro'
        t0 = mb[0][0]
        o = (t0 - phase) % bar
        if o < 1e-6 or bar - o < 1e-6: pickup, lead, S = 0.0, 0.0, t0
        elif bar - o <= bar / 2 + 1e-6: pickup, lead, S = round(bar - o, 4), 0.0, t0
        else: pickup, lead, S = 0.0, o, t0 - o
        full0 = (t0 + pickup) if pickup else S                    # where the first whole bar starts
        maxb = 34
        cands = []
        for nb in range(6, maxb + 1):
            E = full0 + nb * bar
            if first_change is not None and E * tpq / scale > first_change + 1: break
            ns = [[s_, min(e_, E), p] for s_, e_, p in mb if s_ < E and s_ >= t0 - 1e-9]
            if len(ns) > 170: break
            if len(ns) < 16: continue
            if build_bars(ns, S, pickup, bar, nb, lead) is None: continue
            cands.append((nb, E, ns))
        if not cands: return 'no window (too few/many notes)'
        # pitches: fold into C4..B5
        key_sig = ksigs[0][1] if ksigs else 'C'
        ks_t, ks_mode = KEYSIG_NAME.get(key_sig, (0, 'maj'))
        results = []
        for nb, E, ns in cands:
            ps = [p for _, _, p in ns]
            lo, hi = min(ps), max(ps)
            if hi - lo > 23: continue
            mean = sum(ps) / len(ps)
            # shifts by whole semitones, smallest first, octave shifts preferred
            best_shift = None
            for tr_semi in [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]:
                ok_oct = []
                for octs in range(-4, 5):
                    sh = octs * 12 + tr_semi
                    if lo + sh >= 60 and hi + sh <= 83: ok_oct.append(sh)
                if ok_oct:
                    sh = min(ok_oct, key=lambda s: abs(mean + s - 72))
                    best_shift = (abs(tr_semi), sh, tr_semi); break
            if not best_shift: continue
            results.append((nb, E, ns, best_shift))
        if not results: return 'range wider than two octaves'
        # the playable tempo of an excerpt: the score's own, slowed until the shortest common note lasts at least ~0.19 s
        def tempo_for(ns_):
            durs_ = sorted(e_ - s_ for s_, e_, p_ in ns_)
            p15_ = durs_[max(0, int(len(durs_) * 0.12))]
            b_ = min(140.0, max(50.0, qbpm * scale))
            if 60.0 / b_ * p15_ < 0.19: b_ = 60.0 * p15_ / 0.19
            return b_, p15_
        # choose the window: near the target length, ending on a cadence
        def score(item):
            nb, E, ns, bs = item
            sc = 0.0
            # closeness to the target length, as it will play (at the playable tempo)
            beats = E - S
            sec_w = beats * 60.0 / max(50.0, tempo_for(ns)[0])
            sc -= abs(math.log(max(1e-6, sec_w / TARGET_SEC))) * 4
            last = ns[-1]
            dur_last = last[1] - last[0]
            endgap = E - last[1]
            if dur_last >= 1.5 - 1e-6 or (dur_last >= 1.0 and endgap > 1e-6): sc += 2
            if abs(E - last[1]) < 1e-6 and dur_last >= 2: sc += 1
            # closing on tonic / dominant of the signature key
            pc = (last[2] + bs[1]) % 12
            # tonic of the written key shifts with the transposition
            tonic = (ks_t + bs[2]) % 12
            if pc == tonic: sc += 2.5
            elif pc == (tonic + 7) % 12: sc += 1
            sc -= max(0.0, endgap) * 0.9
            # a transposition is a cost
            sc -= bs[0] * 0.8
            # fewer rests is better
            rest_beats = (E - S) - sum(e - s for s, e, p in ns)
            sc -= rest_beats / max(1.0, E - S) * 3
            return sc
        nb, E, ns, bs = max(results, key=score)
        shift = bs[1]; semis = bs[2]
        # playable tempo
        bpm, p15 = tempo_for(ns)
        if bpm < 50.0:
            # very fast figures: accept 50 only when the shortest common note stays above 0.15 s
            if 60.0 / 50.0 * p15 >= 0.15: bpm = 50.0
            else: return f'too fast ({60.0 / 50.0 * p15:.2f}s)'
        bpm = int(round(bpm))
        total_beats = E - S
        sec = total_beats * 60 / bpm
        # shorten the window if the piece would run over 110 s
        # (done by choosing a smaller nb: re-run score restricted)
        if sec > MAX_SEC or sec < MIN_SEC:
            ok = [r for r in results if MIN_SEC <= (r[1] - S) * 60 / bpm <= MAX_SEC]
            if not ok: return f'length {sec:.0f}s'
            nb, E, ns, bs = max(ok, key=score); shift = bs[1]; semis = bs[2]
            total_beats = E - S; sec = total_beats * 60 / bpm
        # shift the notes, drop the held-over ends
        fin = [[s, e, p + shift] for s, e, p in ns]
        bars = build_bars(fin, S, pickup, bar, nb, lead_rest=lead)
        if bars is None: return 'empty bar'
        reps = sum(1 for k in range(1, len(fin)) if fin[k][2] == fin[k - 1][2])
        run = 1; maxrun = 1
        for k in range(1, len(fin)):
            run = run + 1 if fin[k][2] == fin[k - 1][2] else 1
            maxrun = max(maxrun, run)
        if reps / len(fin) > 0.5 or maxrun > 10: return f'repetitive line ({reps}/{len(fin)}, run {maxrun})'
        if len({p % 12 for _, _, p in fin}) < 4: return 'fewer than 4 pitch classes'
        # key estimate from the excerpt
        w = [0.0] * 12
        for s, e, p in fin: w[p % 12] += (e - s)
        c, tonic, mode = best_key(w)
        sig_tonic = (ks_t + semis) % 12
        r_sig = diatonic_ratio(w, sig_tonic, ks_mode)
        r_est = diatonic_ratio(w, tonic, mode)
        if r_sig >= r_est - 0.04: tonic, mode = sig_tonic, ks_mode
        key = key_name(tonic, mode)
        ratio = diatonic_ratio(w, tonic, mode)
        rest_beats = (E - S) - sum(e - s for s, e, p in ns)
        out = ({'ok': True, 'rest': round(rest_beats / max(1e-9, E - S), 3), 'meter': meter, 'bpm': bpm, 'pickup': pickup, 'bars': bars, 'key': key, 'diatonic': round(ratio, 3),
                  'nb': nb, 'notes': len(fin), 'sec': round(sec), 'lead': lead, 'shift': shift, 'semis': semis,
                  'qbpm_src': qbpm_src, 'track': tr['name'], 'ntracks': len(tracks), 'offgrid': R.get('offgrid', 0), 'scale': scale,
                  'part': part})
        return (score((nb, E, ns, (abs(semis), shift, semis))), out)
    best = None; why_last = 'no window'
    for si, bi in enumerate(starts):
        cut = phase + bi * bar
        mbs = [m for m in mb_all if m[0] >= cut - 1e-9]
        res = build_for(mbs)
        if isinstance(res, str): why_last = res; continue
        sc = res[0] - 0.8 * si
        if best is None or sc > best[0]: best = (sc, res[1], si)
        if si >= 3: break
    if best is None: R['why'] = why_last; return R
    R.update(best[1]); R['skipped_bars'] = best[2]
    return R

def main():
    pat = re.compile(sys.argv[1]) if len(sys.argv) > 1 else None
    res = []
    stat = collections.Counter()
    for pid, info in meta.items():
        if pat and not pat.search(pid): continue
        d = f'{MIDI}/{pid}'
        if not os.path.exists(d + '/.done'): continue
        try:
            rs = process(pid, info)
        except Exception as e:
            rs = [{'pid': pid, 'ok': False, 'why': 'exception ' + repr(e)[:80]}]
        if not rs: stat['nomidi'] += 1; continue
        for r in rs:
            r['info'] = {k: info[k] for k in ('path', 'composer', 'title', 'opus', 'instrument', 'style', 'date', 'source')}
            res.append(r)
            stat['ok' if r['ok'] else 'fail: ' + re.sub(r'[\d.]+', '#', r['why'])[:40]] += 1
    json.dump(res, open(f'{WORK}/cands.json', 'w'), ensure_ascii=False)
    for k, v in stat.most_common(): print(f'{v:5d}  {k}')
    print(len(res), 'results')

if __name__ == '__main__':
    main()
