#!/usr/bin/env python3
"""MusicXML (.mxl / .xml / .musicxml, score-partwise) -> the same note lists that extract.read_midi gives, so the rest of the
pipeline (quantising, bars, key, tempo) is shared between the two kinds of source.

  python3 musicxml.py FILE.mxl        # prints what it read (parts, meter, key, tempo, pickup, first notes)

Returns (tpq, tracks, tsigs, ksigs, tempos, info) where
  tracks  = [{'name': part name, 'notes': [(start_tick, end_tick, midi), ...]}]   one per <part>, ties joined, grace notes dropped
  tsigs   = [(tick, numerator, denominator)]            ksigs = [(tick, 'Eb' | 'Gm' ...)]        tempos = [(tick, microseconds per quarter)]
  info    = {'pickup': beats of the short first measure (0 when it is a whole bar), 'work', 'movement', 'composer', 'irregular_meter'}
Time is measured from the start of the first measure (a pickup bar counts), like a LilyPond MIDI file with \\partial."""
import re, sys, zipfile
import xml.etree.ElementTree as ET
from fractions import Fraction

TPQ = 1920                                    # ticks per quarter note: divisible by 2, 3, 4, 5, 6, 8, 10, 12, 16 ...
STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
KEYS_MAJ = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
KEYS_MIN = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']


def _root(path):
    if path.lower().endswith('.mxl'):
        z = zipfile.ZipFile(path)
        name = None
        if 'META-INF/container.xml' in z.namelist():
            m = re.search(r'full-path="([^"]+)"', z.read('META-INF/container.xml').decode('utf-8', 'replace'))
            if m: name = m.group(1)
        if not name:
            name = next(n for n in z.namelist() if n.lower().endswith(('.xml', '.musicxml')) and not n.startswith('META-INF'))
        return ET.fromstring(z.read(name))
    return ET.parse(path).getroot()


def _int(el, tag, default=None):
    v = el.findtext(tag)
    try: return int(float(v)) if v is not None else default
    except ValueError: return default


def _parse_part(part):
    """-> list of measures; each {'items': [...], 'len': quarters, 'attrs': [...], 'tempos': [...], 'implicit': bool}
    items are ('n', start, dur, midi|None, tie_start, tie_stop) in quarter notes counted from the measure start (Fractions)."""
    div = 1
    out = []
    for meas in part.findall('measure'):
        pos = Fraction(0); maxpos = Fraction(0); last_start = Fraction(0)
        items = []; attrs = []; tempos = []
        for el in meas:
            tag = el.tag
            if tag == 'attributes':
                d = _int(el, 'divisions')
                if d: div = d
                for k in el.findall('key'):
                    f = _int(k, 'fifths')
                    if f is not None: attrs.append(('key', f, (k.findtext('mode') or '').strip().lower()))
                for t in el.findall('time'):
                    b, bt = t.findtext('beats'), t.findtext('beat-type')
                    if b is not None and bt is not None: attrs.append(('time', b.strip(), bt.strip()))
            elif tag == 'direction':
                s = el.find('sound')
                if s is not None and s.get('tempo'):
                    try: tempos.append((pos, float(s.get('tempo'))))
                    except ValueError: pass
            elif tag == 'sound':
                if el.get('tempo'):
                    try: tempos.append((pos, float(el.get('tempo'))))
                    except ValueError: pass
            elif tag == 'note':
                if el.find('grace') is not None: continue                    # a grace note takes no time in the score
                dur = _int(el, 'duration', 0)
                d = Fraction(dur, div)
                is_chord = el.find('chord') is not None
                start = last_start if is_chord else pos
                if el.find('rest') is None and el.find('pitch') is not None:
                    p = el.find('pitch')
                    step = (p.findtext('step') or 'C').strip().upper()
                    alt = p.findtext('alter')
                    try: alter = int(round(float(alt))) if alt is not None else 0
                    except ValueError: alter = 0
                    octv = _int(p, 'octave', 4)
                    midi = 12 * (octv + 1) + STEP.get(step, 0) + alter
                    ties = {t.get('type') for t in el.findall('tie')}
                    if not ties:
                        ties = {t.get('type') for t in el.iter('tied')}
                    items.append(('n', start, d, midi, 'start' in ties, 'stop' in ties))
                if not is_chord:
                    last_start = pos; pos += d
                    maxpos = max(maxpos, pos)
            elif tag == 'backup':
                pos -= Fraction(_int(el, 'duration', 0), div)
            elif tag == 'forward':
                pos += Fraction(_int(el, 'duration', 0), div); maxpos = max(maxpos, pos)
        out.append({'items': items, 'len': maxpos, 'attrs': attrs, 'tempos': tempos, 'implicit': meas.get('implicit') == 'yes'})
    return out


def read_mxl(path):
    root = _root(path)
    if root.tag != 'score-partwise': raise ValueError('not a score-partwise MusicXML file')
    names = {sp.get('id'): (sp.findtext('part-name') or '').strip() for sp in root.iter('score-part')}
    parts = [(p.get('id'), _parse_part(p)) for p in root.findall('part')]
    if not parts: raise ValueError('no parts')
    nm = max(len(m) for _, m in parts)
    # one timeline for all parts: a measure is as long as the longest of its parts
    lens = [max((m[i]['len'] for _, m in parts if i < len(m)), default=Fraction(0)) for i in range(nm)]
    starts = []; acc = Fraction(0)
    for L in lens: starts.append(acc); acc += L
    tk = lambda q: int(round(q * TPQ))

    tsigs = []; ksigs = []; tempos = []; irregular = False
    first = parts[0][1]
    nominal = None
    for i, m in enumerate(first):
        for a in m['attrs']:
            if a[0] == 'key':
                fifths, mode = a[1], a[2]
                idx = fifths + 7
                if 0 <= idx < 15: ksigs.append((tk(starts[i]), (KEYS_MIN if mode.startswith('min') else KEYS_MAJ)[idx]))
            elif a[0] == 'time':
                if re.fullmatch(r'\d+', a[1]) and re.fullmatch(r'\d+', a[2]):
                    tsigs.append((tk(starts[i]), int(a[1]), int(a[2])))
                    if nominal is None: nominal = Fraction(int(a[1]) * 4, int(a[2]))
                else:
                    irregular = True
        for pos, bpm in m['tempos']:
            if bpm > 0: tempos.append((tk(starts[i] + pos), int(round(60e6 / bpm))))
    if nominal is None: nominal = Fraction(4)
    pickup = Fraction(0)
    if lens and lens[0] < nominal and lens[0] > 0: pickup = lens[0]

    tracks = []
    for pid, meas in parts:
        notes = []; open_tie = {}
        for i, m in enumerate(meas):
            for _, st, d, midi, tie_start, tie_stop in m['items']:
                s, e = starts[i] + st, starts[i] + st + d
                if tie_stop and midi in open_tie and notes[open_tie[midi]][1] == s:
                    j = open_tie[midi]
                    notes[j] = (notes[j][0], e, midi)
                    if not tie_start: del open_tie[midi]
                    continue
                notes.append((s, e, midi))
                if tie_start: open_tie[midi] = len(notes) - 1
                else: open_tie.pop(midi, None)
        notes = sorted((tk(s), tk(e), p) for s, e, p in notes if e > s)
        tracks.append({'name': names.get(pid, pid), 'notes': notes})
    info = {'pickup': float(pickup), 'irregular_meter': irregular, 'measures': nm,
            'work': (root.findtext('work/work-title') or '').strip(), 'movement': (root.findtext('movement-title') or '').strip(),
            'composer': next(((c.text or '').strip() for c in root.iter('creator') if c.get('type') == 'composer'), '')}
    return TPQ, tracks, sorted(set(tsigs)), sorted(set(ksigs)), sorted(set(tempos)), info


if __name__ == '__main__':
    tpq, tracks, ts, ks, tp, info = read_mxl(sys.argv[1])
    print(info); print('time', ts[:4], 'key', ks[:4], 'tempo', [(t, round(60e6 / u, 1)) for t, u in tp[:3]])
    for t in tracks:
        n = t['notes']
        print(repr(t['name']), len(n), 'notes; first:', [(round(s / tpq, 3), round((e - s) / tpq, 3), m) for s, e, m in n[:8]])
