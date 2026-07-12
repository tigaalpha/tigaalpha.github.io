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
