// Strips markdown / formatting artifacts from AI-generated text before it
// reaches a customer (LINE/web chat). The model occasionally leaks **bold**,
// ~~strikethrough~~, `code`, bullet lists, or repeated punctuation ("!!")
// into replies — on LINE a ~~struck-through~~ line even renders crossed
// out, which reads as broken, bot-like copy. This is the safety net that
// guarantees a reply is nothing but natural sentences.
export function cleanReplyText(text: string): string {
  let t = text
    // fenced code blocks and inline code
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`/g, "")
    // markdown emphasis / strikethrough
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/~~/g, "")
    .replace(/__/g, "")
    // markdown links → just the visible text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // stray HTML tags (harmless in Thai chat; "<3" has no closing ">" and survives)
    .replace(/<[^>]+>/g, "");

  // strip heading / bullet / numbered-list markers at the start of a line
  t = t
    .split("\n")
    .map((line) => line.replace(/^\s*(#{1,6}\s+|\*+\s+|-{1,3}\s+|•\s+|[–—]\s+|\d+[.)]\s+)/, ""))
    .join("\n");

  // repeated exclamation/question marks → single (no "!!", no "???")
  t = t.replace(/[!?]{2,}/g, (m) => m[0]);

  // tidy whitespace
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}
