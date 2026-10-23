/* Fifteen more concept clips per language (owner, 2026-10-23: "20 videos, same pattern, different and better content"). Same shape as the first five in
   `concept-clips.tsx`: 4 slides, one short sentence each, a drawn scene kind per slide. Practice advice here is general piano pedagogy, hedged where the evidence is
   not settled; nothing is quoted from a third party. */
import type { Clip } from "./concept-clips";

type K = "neurons" | "keys" | "wave" | "timer" | "grid" | "bridge" | "ecg" | "orbit" | "staff" | "rings";
const S = (ic: string, h: string, b: string) => ({ ic, h, b });

export const MORE_EN: Clip[] = [
  { id: "posture", title: "Sit so your hands can relax", sub: "Posture and freedom", hue: 190, slides: [
    S("🪑", "Find your height", "Sit so your forearms are about level with the keys, with your elbows a little in front of your body."),
    S("🦶", "Feet on the floor", "Let both feet rest flat, so your back and shoulders are not holding you up."),
    S("🫁", "Breathe out", "Check your shoulders. If they are near your ears, breathe out and let them drop."),
    S("🎯", "Try this today", "Before you play, take three slow breaths and shake out your hands for ten seconds."),
  ] },
  { id: "relax", title: "Why tension slows you down", sub: "Relaxed hands move faster", hue: 140, slides: [
    S("✊", "Tight hands tire", "A hand that grips the keys uses more energy and gets tired quickly."),
    S("🪶", "Weight, not force", "Let the weight of your arm sink into each key, instead of pushing down with muscle."),
    S("🔍", "Look for tight spots", "Wrists, thumbs and shoulders often hold tension without you noticing."),
    S("🎼", "Try this today", "Play a slow scale and stop at every note. Ask yourself, is anything tight right now?"),
  ] },
  { id: "slow", title: "The power of playing slowly", sub: "Slow is how fast is built", hue: 30, slides: [
    S("🐢", "Slow first", "When you play slowly, your brain has time to choose each finger and each note on purpose."),
    S("🧱", "Build the path", "Careful slow repeats build a clean path, and speed can then grow on top of it."),
    S("📈", "Raise it in small steps", "When it is clean three times in a row, raise the speed just a little."),
    S("✅", "Try this today", "Pick one hard bar and play it at half speed until it feels easy."),
  ] },
  { id: "metronome", title: "Making friends with the metronome", sub: "A steady pulse", hue: 250, slides: [
    S("⏱️", "A steady friend", "A metronome is not a judge. It simply keeps the beat steady so you can notice yours."),
    S("🐌", "Start slow", "Set it slow enough that you never rush, even in the hard places."),
    S("👂", "Listen between clicks", "Try to land your notes right on the click, so your ear learns what steady sounds like."),
    S("🔧", "Try this today", "Practise one passage with the metronome, then play it once without and compare."),
  ] },
  { id: "reading", title: "Reading music without panic", sub: "Sight-reading skills", hue: 60, slides: [
    S("👀", "Look ahead", "Good readers keep their eyes one beat ahead of their hands, like reading a book."),
    S("🔁", "Keep going", "Do not stop to fix mistakes. Keep the beat moving, because that is what a real reading is."),
    S("🧩", "See patterns", "Notice steps, skips, repeated notes and chords, instead of naming every single note."),
    S("📖", "Try this today", "Read one easy new piece every day. Easy and new beats hard and familiar for reading."),
  ] },
  { id: "ear", title: "Training your ear", sub: "Hear it before you play it", hue: 300, slides: [
    S("👂", "Ears lead", "The ear is a musician's most important tool, and it can be trained like a muscle."),
    S("🎤", "Sing it first", "Hum or sing the next phrase before you play it. Your fingers follow what your ear expects."),
    S("↕️", "Up or down", "Start with the simple question: did that note go up or down?"),
    S("🎶", "Try this today", "Pick a song you know and try to find its first five notes by ear."),
  ] },
  { id: "scales", title: "Why scales are worth it", sub: "A map of the keyboard", hue: 100, slides: [
    S("🗺️", "A map of keys", "Most music is built from scales, so practising them is learning the map."),
    S("✋", "Fingering habits", "Scales teach your hand the fingering patterns it will meet again and again in pieces."),
    S("🎚️", "Even sound", "Try to make every note the same loudness and length. That is a clear, simple goal."),
    S("⏳", "Try this today", "Two minutes of one scale, slowly and evenly, before your piece."),
  ] },
  { id: "hands", title: "Hands separate, then together", sub: "Divide and combine", hue: 340, slides: [
    S("🙌", "Divide", "A hard passage is easier when you learn each hand alone first."),
    S("🔬", "Know each part", "Play the left hand until you do not have to think about it, then the right."),
    S("🤝", "Join slowly", "Put the hands together at a slow speed. It is normal for it to feel clumsy at first."),
    S("🧠", "Try this today", "Take four bars. Left hand, right hand, then both slowly. Repeat the next day."),
  ] },
  { id: "mistakes", title: "Mistakes are information", sub: "Learning from errors", hue: 0, slides: [
    S("❌", "Not a failure", "A wrong note tells you exactly where the practice needs to go."),
    S("🔎", "Find the cause", "Was it the fingering, the rhythm, or the reading? Fix the cause, not just the note."),
    S("♻️", "Fix and repeat", "After you fix it, play the spot correctly several times so the right way becomes the habit."),
    S("😊", "Try this today", "When you miss a note, say out loud what went wrong, then try again calmly."),
  ] },
  { id: "sleep", title: "Sleep helps you remember", sub: "Practice and rest", hue: 230, slides: [
    S("🌙", "The brain keeps working", "Research suggests that sleep helps the brain sort and strengthen what you learned that day."),
    S("📆", "Little and often", "That is one more reason a short practice every day works better than a long cram."),
    S("🌅", "Morning check", "Sometimes a passage feels easier the next day, even though you did nothing else."),
    S("🛏️", "Try this today", "Practise your hardest spot in the evening, and test it again tomorrow morning."),
  ] },
  { id: "breaks", title: "Take breaks and come back", sub: "Spaced practice", hue: 120, slides: [
    S("⏸️", "Rest on purpose", "Short breaks help you stay sharp, and your attention drops when you push without stopping."),
    S("🔀", "Mix it up", "Switching between two or three spots, instead of one, often helps things stick."),
    S("⏰", "Spacing", "Meeting the same material again after a gap is a strong way to remember it."),
    S("🧃", "Try this today", "Practise in short rounds, with a one-minute break between each."),
  ] },
  { id: "listen", title: "Listen to great playing", sub: "Fill your inner ear", hue: 270, slides: [
    S("🎧", "Hear the goal", "When you listen to a good recording, you learn what you are aiming for."),
    S("🧭", "Notice choices", "Listen for how the player shapes the phrases, and where they breathe."),
    S("🗣️", "Copy, then choose", "Try imitating what you like, and then find your own way."),
    S("📻", "Try this today", "Listen to your piece twice before your next practice, and mark one thing you liked."),
  ] },
  { id: "nerves", title: "Playing for other people", sub: "Handling nerves", hue: 15, slides: [
    S("💓", "Nerves are normal", "A fast heartbeat before you play is common, even for professionals."),
    S("🎭", "Practise performing", "Play your piece for a friend, a pet, or a phone camera, so being watched feels familiar."),
    S("🐢", "Slow breath", "Breathe out slowly before you start. It helps your body settle."),
    S("🌟", "Try this today", "Play your piece once, all the way through, without stopping. Do it as a small performance."),
  ] },
  { id: "counting", title: "Counting makes rhythm clear", sub: "Feel the beat", hue: 200, slides: [
    S("🔢", "Say the numbers", "Counting out loud, one, two, three, four, shows you exactly where each note belongs."),
    S("🥁", "Tap first", "Tap the rhythm on your knee before you play it, without worrying about the notes."),
    S("➗", "Subdivide", "In the hard places, count the small beats, one and two and, to stay precise."),
    S("🎵", "Try this today", "Pick a tricky rhythm. Tap it and count it three times, and then play it."),
  ] },
  { id: "dynamics", title: "Make it sound like music", sub: "Loud, soft and shape", hue: 45, slides: [
    S("🔈", "More than notes", "Playing the right notes is the start. Loud and soft is what makes it music."),
    S("🌊", "Shape phrases", "Let a phrase rise and fall, like a sentence you are speaking."),
    S("🤫", "Use the quiet", "Soft playing needs control, so it is a skill worth practising on purpose."),
    S("🎨", "Try this today", "Play the same four bars twice. First very softly, and then with a big crescendo. Which do you prefer?"),
  ] },
];

export const MORE_ZH: Clip[] = [
  { id: "posture", title: "坐对位置，双手才放松", sub: "姿势与自由", hue: 190, slides: [
    S("🪑", "找到合适的高度", "坐下时让前臂大致与琴键齐平，手肘稍微在身体前方。"),
    S("🦶", "双脚踩稳", "让双脚平放在地上，这样背和肩膀就不用撑住整个身体。"),
    S("🫁", "慢慢呼气", "检查肩膀。如果耸到耳朵附近，就呼一口气，让它们放下来。"),
    S("🎯", "今天试试", "弹琴之前，先慢慢呼吸三次，再把双手抖松十秒钟。"),
  ] },
  { id: "relax", title: "为什么紧张会让你变慢", sub: "放松的手更灵活", hue: 140, slides: [
    S("✊", "紧绷会累", "手如果一直用力抓着琴键，就会消耗更多力气，很快就累了。"),
    S("🪶", "用重量，不用蛮力", "让手臂的重量沉进每个琴键，而不是靠肌肉往下压。"),
    S("🔍", "找出紧的地方", "手腕、拇指和肩膀常常在你没发觉时就绷紧了。"),
    S("🎼", "今天试试", "慢慢弹一个音阶，每个音都停一下，问问自己：现在哪里在用力？"),
  ] },
  { id: "slow", title: "慢弹的力量", sub: "速度是慢慢练出来的", hue: 30, slides: [
    S("🐢", "先慢", "弹得慢，大脑才有时间有意识地选择每根手指和每个音。"),
    S("🧱", "打好基础", "认真的慢速重复会铺出一条干净的路，速度可以在上面慢慢增加。"),
    S("📈", "一点一点加速", "连续三次都弹得干净，再把速度提高一点点。"),
    S("✅", "今天试试", "挑一个难的小节，用一半的速度弹，直到觉得轻松为止。"),
  ] },
  { id: "metronome", title: "和节拍器交朋友", sub: "稳定的脉搏", hue: 250, slides: [
    S("⏱️", "稳定的朋友", "节拍器不是裁判，它只是把拍子保持稳定，让你察觉自己的节奏。"),
    S("🐌", "从慢开始", "把速度调得够慢，即使遇到难的地方也不会抢拍。"),
    S("👂", "听点与点之间", "尽量让音符落在滴答声上，让耳朵记住什么叫稳定。"),
    S("🔧", "今天试试", "用节拍器练一段，再不用节拍器弹一遍，比较一下。"),
  ] },
  { id: "reading", title: "不慌张地读谱", sub: "视奏技巧", hue: 60, slides: [
    S("👀", "往前看", "好的读谱者眼睛总比手早一拍，就像读书一样。"),
    S("🔁", "继续往前", "不要为了改错而停下来，让拍子继续走，这才是真正的读谱。"),
    S("🧩", "看出规律", "留意级进、跳进、重复音和和弦，而不是一个个念出音名。"),
    S("📖", "今天试试", "每天读一首简单的新曲。练读谱，简单又新鲜比困难又熟悉更有效。"),
  ] },
  { id: "ear", title: "训练你的耳朵", sub: "先听见，再弹出", hue: 300, slides: [
    S("👂", "耳朵带路", "耳朵是音乐家最重要的工具，而且可以像肌肉一样训练。"),
    S("🎤", "先唱出来", "弹之前先哼唱下一句，手指会跟着耳朵的期待走。"),
    S("↕️", "上行还是下行", "从最简单的问题开始：这个音是往上还是往下？"),
    S("🎶", "今天试试", "挑一首你熟悉的歌，试着用耳朵找出它的前五个音。"),
  ] },
  { id: "scales", title: "音阶为什么值得练", sub: "琴键的地图", hue: 100, slides: [
    S("🗺️", "琴键的地图", "大多数音乐都由音阶构成，练音阶就是在认识这张地图。"),
    S("✋", "指法习惯", "音阶会教会手掌一再出现在乐曲里的指法模式。"),
    S("🎚️", "均匀的声音", "试着让每个音一样大声、一样长。这是一个清楚又简单的目标。"),
    S("⏳", "今天试试", "在练曲子之前，先花两分钟慢而均匀地弹一个音阶。"),
  ] },
  { id: "hands", title: "先分手，再合手", sub: "分开，再合起来", hue: 340, slides: [
    S("🙌", "先分开", "难的段落，先单手练会更容易。"),
    S("🔬", "弄懂每一部分", "左手练到不用思考，再换右手。"),
    S("🤝", "慢慢合手", "用很慢的速度把双手合起来。一开始觉得笨拙是很正常的。"),
    S("🧠", "今天试试", "取四个小节，先左手，再右手，然后慢速双手。明天再重复一次。"),
  ] },
  { id: "mistakes", title: "错音是一种信息", sub: "从错误中学习", hue: 0, slides: [
    S("❌", "不是失败", "弹错一个音，其实是在告诉你该往哪里练。"),
    S("🔎", "找出原因", "是指法、节奏，还是读谱的问题？要改的是原因，不只是那个音。"),
    S("♻️", "改正再重复", "改好以后，把那个地方正确地弹几遍，让正确的方式变成习惯。"),
    S("😊", "今天试试", "弹错时，大声说出是哪里出了问题，然后冷静地再试一次。"),
  ] },
  { id: "sleep", title: "睡眠帮你记住", sub: "练习与休息", hue: 230, slides: [
    S("🌙", "大脑还在工作", "研究认为，睡眠有助于大脑整理并巩固你当天学到的内容。"),
    S("📆", "少量而常练", "这也是为什么每天短时间练习，比临时抱佛脚更有效。"),
    S("🌅", "早上检查", "有时隔天一早，一个段落就变得容易了，尽管你什么也没多做。"),
    S("🛏️", "今天试试", "晚上练你最难的地方，明早再弹一次，看看有什么不同。"),
  ] },
  { id: "breaks", title: "休息一下再回来", sub: "间隔练习", hue: 120, slides: [
    S("⏸️", "有意地休息", "短暂的休息能让你保持专注，一直硬撑只会让注意力下降。"),
    S("🔀", "换着练", "在两三个地方之间轮流练，通常比只练一个地方更容易记住。"),
    S("⏰", "间隔", "隔一段时间再接触同样的内容，是很有效的记忆方式。"),
    S("🧃", "今天试试", "分成几个短回合练习，每回合之间休息一分钟。"),
  ] },
  { id: "listen", title: "多听好的演奏", sub: "充实你的内在听觉", hue: 270, slides: [
    S("🎧", "听见目标", "听一段好的录音，你就知道自己要追求的声音是什么样。"),
    S("🧭", "留意选择", "听演奏者怎么塑造乐句，又在哪里换气。"),
    S("🗣️", "先模仿，再选择", "试着模仿你喜欢的处理，然后再找出属于自己的方式。"),
    S("📻", "今天试试", "下次练习前，把你的曲子听两遍，并记下一个你喜欢的地方。"),
  ] },
  { id: "nerves", title: "为别人演奏", sub: "面对紧张", hue: 15, slides: [
    S("💓", "紧张很正常", "上台前心跳加快很常见，连专业演奏家也一样。"),
    S("🎭", "练习表演", "把曲子弹给朋友、宠物或手机镜头听，让被注视变成熟悉的事。"),
    S("🐢", "慢慢呼气", "开始前慢慢吐气，有助于身体平静下来。"),
    S("🌟", "今天试试", "把曲子从头到尾弹一遍，中间不停下来，把它当成一场小小的演出。"),
  ] },
  { id: "counting", title: "数拍让节奏清楚", sub: "感受拍子", hue: 200, slides: [
    S("🔢", "把数字说出来", "大声数一、二、三、四，能清楚看出每个音该落在哪里。"),
    S("🥁", "先拍再弹", "弹之前先用手在膝盖上拍出节奏，先不用管音符。"),
    S("➗", "细分拍子", "在难的地方数更小的拍子，一 和 二 和，让节奏保持精准。"),
    S("🎵", "今天试试", "挑一个难的节奏，拍三遍、数三遍，然后再弹出来。"),
  ] },
  { id: "dynamics", title: "让它听起来像音乐", sub: "强弱与塑形", hue: 45, slides: [
    S("🔈", "不只是音符", "弹对音符只是开始，强弱变化才让它成为音乐。"),
    S("🌊", "塑造乐句", "让一个乐句有起有落，就像你在说一句话。"),
    S("🤫", "善用轻声", "轻柔的演奏需要控制力，值得有意识地去练。"),
    S("🎨", "今天试试", "把同样的四个小节弹两遍：第一遍非常轻，第二遍加上大的渐强。你更喜欢哪一种？"),
  ] },
];

export const MORE_SCENES: Record<string, K[]> = {
  posture: ["rings", "timer", "wave", "keys"],
  relax: ["wave", "bridge", "orbit", "keys"],
  slow: ["timer", "grid", "ecg", "keys"],
  metronome: ["ecg", "timer", "wave", "staff"],
  reading: ["staff", "rings", "grid", "keys"],
  ear: ["wave", "orbit", "ecg", "staff"],
  scales: ["grid", "keys", "wave", "timer"],
  hands: ["bridge", "keys", "orbit", "neurons"],
  mistakes: ["rings", "orbit", "ecg", "neurons"],
  sleep: ["wave", "grid", "rings", "timer"],
  breaks: ["timer", "orbit", "grid", "rings"],
  listen: ["wave", "orbit", "staff", "keys"],
  nerves: ["ecg", "staff", "wave", "rings"],
  counting: ["grid", "ecg", "timer", "keys"],
  dynamics: ["wave", "staff", "rings", "orbit"],
};
