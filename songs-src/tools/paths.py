"""Where the song pipeline keeps its files (shared by the scripts in this folder).

  SONGS_WORK=/path/to/scratch   a folder with about 2 GB free; default: <repo>/node_modules/.cache/songs-work
Layout inside it (see README.md for how each part is made):
  mutopia/ftp/    sparse clone of the Mutopia Project (the typeset scores)
  venv/           python venv with `lilypond` 2.25.x (+ mido) from PyPI      -> compile_all.py
  v224/           python venv with `lilypond` 2.24.3 and its convert-ly      -> compile_conv.py
  midi/<pid>/     the MIDI files LilyPond wrote, one folder per score
  inventory.json  meta.json  cands.json  pool.json  pool.tsv  titles-in/  titles-out/
"""
import os, glob

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('SONGS_WORK') or os.path.join(REPO, 'node_modules', '.cache', 'songs-work')
MUTOPIA = os.path.join(WORK, 'mutopia', 'ftp')
MIDI = os.path.join(WORK, 'midi')


def lilypond_bin_dir(venv):
    """folder holding lilypond / convert-ly inside the venv `venv` (a name under WORK)"""
    g = sorted(glob.glob(os.path.join(WORK, venv, 'lib', 'python3*', 'site-packages', 'lilypond-binaries', 'bin')))
    return g[0] if g else os.path.join(WORK, venv, 'bin')
