/* ── tigamodel/knowledge/university-sources.js ──
   Source registry for university-sourced music knowledge (spec §10-§12).

   Collection method (owner directive 2026-09-17): gather music knowledge
   attributed to leading music universities/conservatories of each country,
   from public internet pages. Every source below was ACTUALLY READ on
   2026-09-17 via its URL (institution site or its Wikipedia article).
   Nothing is invented; if a fact is not backed by a page we could open,
   it is NOT in this file. Content written from these sources is
   PARAPHRASED pedagogical facts (not copied text), each carrying its
   source_id so every KB entry stays traceable (no fake citations — §12).

   License stance: facts about curricula/traditions are ideas/facts (not
   copyrightable expression); paraphrased in our own words; source metadata
   recorded for provenance. No proprietary course materials are reproduced. ── */

export const SOURCES = {
  "mahidol-music-wiki": {
    title: "College of Music, Mahidol University — overview and history",
    url: "https://en.wikipedia.org/wiki/College_of_Music,_Mahidol_University",
    site: "en.wikipedia.org",
    institution: "College of Music, Mahidol University (Thailand)",
    country: "TH",
    institution_url: "http://www.music.mahidol.ac.th",
    read_at: "2026-09-17",
    reliability: "high", // tertiary source with cited facts about the institution
    notes: "First comprehensive music school in Thailand (est. 1994); teaching continuum from age 3 through Ph.D.; large general-public music campus.",
  },
  "berklee-wiki": {
    title: "Berklee College of Music — history and contemporary-music focus",
    url: "https://en.wikipedia.org/wiki/Berklee_College_of_Music",
    site: "en.wikipedia.org",
    institution: "Berklee College of Music (USA)",
    country: "US",
    institution_url: "https://berklee.edu",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Largest independent contemporary-music college; founded around the Schillinger System of harmony and composition; practitioner-taught model; jazz/contemporary emphasis.",
  },
  "berklee-home": {
    title: "Berklee College of Music — official site (areas of study)",
    url: "https://www.berklee.edu/",
    site: "berklee.edu",
    institution: "Berklee College of Music (USA)",
    country: "US",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Official study areas include Music Theory, Ear Training, Harmony as a distinct discipline cluster; Piano as a dedicated performance area.",
  },
  "juilliard-wiki": {
    title: "The Juilliard School — history and structure",
    url: "https://en.wikipedia.org/wiki/Juilliard_School",
    site: "en.wikipedia.org",
    institution: "The Juilliard School (USA)",
    country: "US",
    institution_url: "https://www.juilliard.edu",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Founded 1905 as Institute of Musical Art; music division largest/oldest; pre-college through doctorate training continuum.",
  },
  "moscow-conservatory-wiki": {
    title: "Moscow State Tchaikovsky Conservatory — history",
    url: "https://en.wikipedia.org/wiki/Moscow_Conservatory",
    site: "en.wikipedia.org",
    institution: "Moscow State Tchaikovsky Conservatory (Russia)",
    country: "RU",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Founded 1866 by Nikolai Rubinstein; Tchaikovsky appointed professor of theory and harmony at opening; piano class taught from the earliest years.",
  },
  "paris-conservatory-wiki": {
    title: "Conservatoire de Paris — history and 'French School' tradition",
    url: "https://en.wikipedia.org/wiki/Conservatoire_de_Paris",
    site: "en.wikipedia.org",
    institution: "Conservatoire de Paris / CNSMDP (France)",
    country: "FR",
    institution_url: "https://www.conservatoiredeparis.fr",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Founded 1795; draws on the 'French School' tradition; historic piano faculty include Louise Farrenc, Henri Herz, Antoine François Marmontel.",
  },
  "ccom-wiki": {
    title: "Central Conservatory of Music — programs and scale",
    url: "https://en.wikipedia.org/wiki/Central_Conservatory_of_Music",
    site: "en.wikipedia.org",
    institution: "Central Conservatory of Music (China)",
    country: "CN",
    institution_url: "http://www.ccom.edu.cn",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "National music academy of China (est. 1950); piano among core undergraduate programs; complete ladder from primary schools through doctorate; owns 500+ pianos.",
  },
  "tokyo-geidai-wiki": {
    title: "Tokyo University of the Arts — music faculty history",
    url: "https://en.wikipedia.org/wiki/Tokyo_University_of_the_Arts",
    site: "en.wikipedia.org",
    institution: "Tokyo University of the Arts / Geidai (Japan)",
    country: "JP",
    institution_url: "https://www.geidai.ac.jp/english/",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "Music education lineage from Tokyo Music School (1887); national arts university integrating fine arts and music; exchanges with European conservatories.",
  },
  "karts-wiki": {
    title: "Korea National University of Arts (K-Arts) — School of Music",
    url: "https://en.wikipedia.org/wiki/Korea_National_University_of_Arts",
    site: "en.wikipedia.org",
    institution: "Korea National University of Arts (South Korea)",
    country: "KR",
    institution_url: "http://www.karts.ac.kr/",
    read_at: "2026-09-17",
    reliability: "medium-high",
    notes: "National arts university (est. 1993) with a dedicated School of Music among its six schools; conservatory-style training model.",
  },
  "rcm-home": {
    title: "Royal College of Music — official site (programmes, Centre for Performance Science)",
    url: "https://www.rcm.ac.uk/",
    site: "rcm.ac.uk",
    institution: "Royal College of Music (UK)",
    country: "UK",
    read_at: "2026-09-17",
    reliability: "high",
    notes: "London conservatoire (est. 1882); intensive public-performance programme ethos; Centre for Performance Science research (performance psychology/science).",
  },
};

/* Countries already covered by a real, read source. Used by the KB seeder to
   label provenance and to make gaps explicit rather than guessed. */
export const COVERAGE = [
  { country: "TH", label: "ไทย", source: "mahidol-music-wiki" },
  { country: "US", label: "สหรัฐอเมริกา", source: "berklee-wiki" },
  { country: "US-2", label: "สหรัฐอเมริกา (conservatory)", source: "juilliard-wiki" },
  { country: "RU", label: "รัสเซีย", source: "moscow-conservatory-wiki" },
  { country: "FR", label: "ฝรั่งเศส", source: "paris-conservatory-wiki" },
  { country: "CN", label: "จีน", source: "ccom-wiki" },
  { country: "JP", label: "ญี่ปุ่น", source: "tokyo-geidai-wiki" },
  { country: "KR", label: "เกาหลีใต้", source: "karts-wiki" },
  { country: "UK", label: "สหราชอาณาจักร", source: "rcm-home" },
];

export function getSource(id) { return SOURCES[id] || null; }

export function listSourceIds() { return Object.keys(SOURCES); }
