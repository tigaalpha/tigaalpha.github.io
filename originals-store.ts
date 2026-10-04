/* originals-store.ts — fetches TiGA's own practice pieces, and only when they are needed.

   The ten thousand originals are NOT in the bundle (see scripts/build-originals.mjs for why).
   Two requests serve them:

     ./originals/index.json      once, when the learner opens the "our own" shelf: the ten
                                 thousand rows — id, level, tempo, the three titles, the first
                                 note (the card's colour) and the length (its clock). No notes.
     ./originals/songs-NN.json   the 500 pieces' tunes, fetched when one of them is chosen.

   Every fetch is remembered for the life of the page, and a request already in flight is
   shared rather than repeated, so opening the shelf twice costs one request and playing
   twenty pieces from one shard costs one. Nothing here writes to localStorage: these files
   are versioned with the build, so a stale copy in storage would be worse than a re-fetch.

   A failed fetch is an ordinary return of null (the shelf shows a retry), never a throw at
   the render: a missing file must not blank the app the way a malformed AI tip once did. */

export type OriginalMeta = {
  id: string; diff: number; bpm: number; th: string; en: string; zh: string;
  hn: string;   // the first note, for the card's colour — the real tune arrives later
  len: number;  // seconds, so the card's clock is right before the notes are loaded
  k: number;    // which shard holds the tune
};
export type OriginalSong = {
  id: string; diff: number; bpm: number; th: string; en: string; zh: string;
  seq: Array<[string, number]>;
  key: string; mode: string; meter: string;
  original: true;
};

/** the shelf's own code in SONG_GENRES / the era chips' language */
export const ORIGINAL_SHELF = "original";

/* './' matches vite.config.ts base "./" and the way sprite.tsx asks for ./sprites/ */
const DIR = "./originals/";

let indexPromise: Promise<OriginalMeta[]> | null = null;
let indexRows: OriginalMeta[] | null = null;
const shardPromises = new Map<number, Promise<Map<string, any>>>();
const shardSongs = new Map<number, Map<string, any>>();

const pairs = (s: string): Array<[string, number]> =>
  s.split(" ").map(t => { const i = t.indexOf(":"); return [t.slice(0, i), +t.slice(i + 1)] as [string, number]; });

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** the shelf. Resolves to [] when the files are missing; the caller shows a retry. */
export function loadOriginalIndex(): Promise<OriginalMeta[]> {
  if (indexRows) return Promise.resolve(indexRows);
  if (!indexPromise) {
    indexPromise = fetchJson(DIR + "index.json")
      .then(j => { indexRows = (j && Array.isArray(j.songs)) ? j.songs : []; return indexRows; })
      .catch(() => { indexPromise = null; return [] as OriginalMeta[]; });
  }
  return indexPromise;
}

function loadShard(k: number): Promise<Map<string, any>> {
  const done = shardSongs.get(k);
  if (done) return Promise.resolve(done);
  let p = shardPromises.get(k);
  if (!p) {
    p = fetchJson(DIR + `songs-${String(k).padStart(2, "0")}.json`)
      .then(j => {
        const m = new Map<string, any>();
        for (const s of (j && j.songs) || []) m.set(s.id, s);
        shardSongs.set(k, m);
        return m;
      })
      .catch(() => { shardPromises.delete(k); return new Map<string, any>(); });
    shardPromises.set(k, p);
  }
  return p;
}

/**
 * The playable song for one shelf row, with its notes. Resolves to null when the shard cannot
 * be read, so the caller can say so instead of opening an empty song.
 */
export async function loadOriginalSong(meta: { id: string; k: number; diff: number; bpm: number; th: string; en: string; zh: string }): Promise<OriginalSong | null> {
  const shard = await loadShard(meta.k);
  const raw = shard.get(meta.id);
  if (!raw || typeof raw.seq !== "string") return null;
  return {
    id: raw.id, diff: raw.diff ?? meta.diff, bpm: raw.bpm ?? meta.bpm,
    th: meta.th, en: meta.en, zh: meta.zh,
    seq: pairs(raw.seq),
    key: raw.key || "", mode: raw.mode || "", meter: raw.meter || "4/4",
    original: true,
  };
}