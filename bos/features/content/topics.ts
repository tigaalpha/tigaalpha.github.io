/** Standing topic list for one-click article generation — edit here to add/remove topics. */
export const STANDING_TOPICS: string[] = [
  "ประโยชน์ของการเรียนเปียโน",
  "ประโยชน์ของดนตรีในเชิงธุรกิจในการประยุกต์ใช้กับชีวิต",
  "ประโยชน์ของดนตรีในการพัฒนาสมาธิ",
  "เทคนิคการเรียนเปียโน",
  "เทคนิคการเรียนดนตรี",
  "นวัตกรรมในดนตรี",
  "นวัตกรรมในเปียโน",
  "การประยุกต์ใช้เทคโนโลยีสำหรับนักเปียโนและนักดนตรี",
  "การตลาดสำหรับนักเปียโนและนักดนตรีและศิลปินอื่นๆ",
  "ดนตรีบำบัด",
];

export function pickRandomTopic(): string {
  return STANDING_TOPICS[Math.floor(Math.random() * STANDING_TOPICS.length)]!;
}

export type ArticleLanguage = "th" | "en" | "zh";

/**
 * Core keywords every generated article must include, translated per language
 * (same meaning, same order across the three lists) — mirrored in
 * supabase/functions/generate-article/index.ts.
 */
export const CORE_KEYWORDS_BY_LANG: Record<ArticleLanguage, string[]> = {
  th: [
    "สอนเปียโน",
    "เรียนเปียโน",
    "สอนดนตรี",
    "เรียนดนตรี",
    "คอร์สสอนเปียโน",
    "คอร์สสอนดนตรี",
    "ครูสอนเปียโนออนไลน์",
    "ครูสอนดนตรีออนไลน์",
  ],
  en: [
    "piano teaching",
    "learn piano",
    "music teaching",
    "learn music",
    "piano course",
    "music course",
    "online piano teacher",
    "online music teacher",
  ],
  zh: ["钢琴教学", "学钢琴", "音乐教学", "学音乐", "钢琴课程", "音乐课程", "在线钢琴老师", "在线音乐老师"],
};

/** Thai keyword list — kept for callers that don't track article language. */
export const CORE_KEYWORDS: string[] = CORE_KEYWORDS_BY_LANG.th;

export function getMissingCoreKeywords(text: string, lang: ArticleLanguage = "th"): string[] {
  return CORE_KEYWORDS_BY_LANG[lang].filter((k) => !text.includes(k));
}
