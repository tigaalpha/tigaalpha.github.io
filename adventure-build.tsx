/* Adventure: the construction episodes (owner, 2026-10-13: "start solo mode with a spaceship-building game: robots build the ship together and we must answer music questions and
   learn music while we do; then separate episodes that build a Dyson sphere around a star, a gas-harvesting base at Jupiter and a mining base in the asteroid belt").
   One engine, four scenarios (`P.kind`: ship, dyson, gas, mine). A scenario is a list of parts. For each part the robot crew asks ONE music question; a right answer powers
   the build (the robots weld it up in a few seconds), a wrong answer teaches the answer first and then asks another question. At the end the player's "music notebook"
   lists what the crew learned. Questions come from what the learner has studied (`nextQuestion`, choice questions only) and from a small trilingual bank. DOM + SVG only. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { nextQuestion } from "./quiz-quest";
import { enterFs } from "./pvp-arena";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
type Part = { icon: string; name: L3; gain: L3; x: number; y: number };
type Scn = { icon: string; title: L3; out: L3; unit: string; per: number; parts: Part[]; sky: string[] };
export const SCENARIOS: Record<string, Scn> = {
  ship: { icon: "🚀", title: ["ยานอาณานิคม 'โพรมีเธียส'", "Colony starship 'Prometheus'", "殖民星舰“普罗米修斯”"], out: ["พลังของยาน", "Ship power", "星舰性能"], unit: "", per: 12, sky: ["#050816", "#1a1c40"], parts: [
    { icon: "🛠", name: ["โครงตัวยาน", "Hull frame", "舰体骨架"], gain: ["แข็งแรงขึ้น", "stronger hull", "舰体更坚固"], x: 80, y: 45 },
    { icon: "⚛", name: ["แกนปฏิกรณ์ฟิวชัน", "Fusion reactor core", "聚变反应堆核心"], gain: ["พลังงานเพียงพอ", "plenty of power", "电力充足"], x: 62, y: 45 },
    { icon: "🔥", name: ["เครื่องยนต์หลัก", "Main engines", "主引擎"], gain: ["เร็วขึ้น", "faster flight", "飞得更快"], x: 28, y: 45 },
    { icon: "🧭", name: ["คอมพิวเตอร์นำทาง", "Navigation computer", "导航计算机"], gain: ["เดินทางแม่นยำ", "precise navigation", "导航精准"], x: 118, y: 45 },
    { icon: "🛡", name: ["เครื่องสร้างโล่", "Shield generator", "护盾发生器"], gain: ["ทนการยิงได้มากขึ้น", "tougher in a fight", "更耐打"], x: 92, y: 24 },
    { icon: "🛏", name: ["ห้องพักลูกเรือ", "Crew quarters", "船员舱"], gain: ["ลูกเรือพักผ่อนได้", "a rested crew", "船员得到休息"], x: 92, y: 66 },
    { icon: "📦", name: ["ห้องบรรทุกอาณานิคม", "Colony cargo bay", "殖民物资舱"], gain: ["บรรทุกผู้อพยพได้มากขึ้น", "room for more settlers", "可载更多移民"], x: 52, y: 66 },
    { icon: "🌀", name: ["ขดลวดวาร์ป", "Warp coil", "曲速线圈"], gain: ["ข้ามระบบดาวได้", "can cross star systems", "可跨越星系"], x: 52, y: 24 },
  ] },
  dyson: { icon: "☀", title: ["ไดสันสเฟียร์ล้อมดาวฤกษ์", "Dyson sphere around a star", "环绕恒星的戴森球"], out: ["พลังงานที่เก็บได้", "Energy collected", "收集的能量"], unit: " PW", per: 4.5, sky: ["#1a0a02", "#5a2a08"], parts: Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2; return { icon: i === 9 ? "📡" : "🟨", name: i === 9 ? ["สถานีส่งลำแสงกลับโลก", "Beam relay to Earth", "回传地球的光束中继站"] : ["แผงรวมแสงวงที่ " + (i + 1), "Collector ring segment " + (i + 1), "集光环段 " + (i + 1)], gain: ["เก็บพลังงานดาวฤกษ์เพิ่ม", "more starlight collected", "收集更多星光"], x: Math.round(80 + Math.cos(a) * 52), y: Math.round(45 + Math.sin(a) * 34) } as Part; }) },
  gas: { icon: "🪐", title: ["ฐานเก็บก๊าซที่ดาวพฤหัส", "Gas-harvesting base at Jupiter", "木星气体采集基地"], out: ["ก๊าซที่เก็บได้", "Gas stored", "储存气体"], unit: " kt", per: 9, sky: ["#1a0f06", "#6a3a14"], parts: [
    { icon: "⚓", name: ["แท่นยึดลอยฟ้า", "Floating anchor platform", "悬浮锚定平台"], gain: ["ฐานมั่นคง", "a stable base", "基地稳固"], x: 80, y: 62 },
    { icon: "🌪", name: ["ปากดูดก๊าซ", "Gas intake scoop", "气体进气口"], gain: ["ดูดก๊าซเข้ามา", "gas flows in", "气体流入"], x: 52, y: 62 },
    { icon: "🗜", name: ["เครื่องอัดก๊าซ", "Compressor", "压缩机"], gain: ["บีบก๊าซให้เล็กลง", "gas compressed", "气体被压缩"], x: 52, y: 40 },
    { icon: "🛢", name: ["ถังเก็บก๊าซ", "Storage tanks", "储气罐"], gain: ["เก็บก๊าซได้มาก", "big storage", "储量巨大"], x: 80, y: 28 },
    { icon: "⚡", name: ["เครื่องปฏิกรณ์ประจำฐาน", "Base reactor", "基地反应堆"], gain: ["ไฟเลี้ยงทั้งฐาน", "power for the base", "为基地供电"], x: 108, y: 40 },
    { icon: "🛰", name: ["วงแหวนจอดยาน", "Docking ring", "对接环"], gain: ["ยานมารับก๊าซได้", "ships can dock", "飞船可对接"], x: 108, y: 62 },
    { icon: "🌩", name: ["โล่กันพายุ", "Storm shield", "风暴护盾"], gain: ["ทนพายุฟ้าผ่า", "survives the storms", "抵御风暴"], x: 80, y: 46 },
    { icon: "🚀", name: ["แท่นยิงถังก๊าซกลับโลก", "Launcher home", "返航发射台"], gain: ["ส่งก๊าซกลับโลก", "gas shipped home", "气体运回地球"], x: 130, y: 50 },
  ] },
  mine: { icon: "☄", title: ["ฐานขุดแร่ในแถบดาวเคราะห์น้อย", "Mining base in the asteroid belt", "小行星带采矿基地"], out: ["แร่ที่ผลิตได้", "Ore produced", "矿石产量"], unit: " kt", per: 7, sky: ["#07090f", "#2a2a34"], parts: [
    { icon: "📍", name: ["สมอยึดดาวเคราะห์น้อย", "Asteroid anchors", "小行星锚固"], gain: ["ไม่ลอยหลุดไป", "it will not drift away", "不会飘走"], x: 80, y: 45 },
    { icon: "⛏", name: ["แท่นเจาะแร่", "Mining rig", "采矿钻机"], gain: ["เจาะแร่ได้", "ore comes out", "开始出矿"], x: 56, y: 38 },
    { icon: "🪨", name: ["เครื่องบดแร่", "Ore crusher", "碎矿机"], gain: ["บดแร่เป็นชิ้นเล็ก", "ore crushed", "矿石被粉碎"], x: 56, y: 58 },
    { icon: "🔥", name: ["เตาถลุง", "Smelter", "冶炼炉"], gain: ["ได้โลหะบริสุทธิ์", "pure metal", "产出纯金属"], x: 104, y: 38 },
    { icon: "🤖", name: ["ท่าจอดโดรนขนส่ง", "Hauler dock", "货运无人机港"], gain: ["ขนแร่ได้เร็วขึ้น", "faster hauling", "运输更快"], x: 104, y: 58 },
    { icon: "⚡", name: ["โรงไฟฟ้า", "Power plant", "发电站"], gain: ["ไฟพอใช้ทั้งฐาน", "base fully powered", "全基地供电"], x: 80, y: 22 },
    { icon: "🏠", name: ["โดมลูกเรือ", "Crew dome", "船员穹顶"], gain: ["มีคนอยู่ประจำ", "a crew on site", "人员常驻"], x: 80, y: 68 },
    { icon: "🚀", name: ["เครื่องยิงแร่กลับโลก", "Mass driver", "质量加速器"], gain: ["ส่งแร่กลับโลก", "ore sent home", "矿石运回地球"], x: 132, y: 46 },
  ] },
};

type Q = { q: L3; o: [L3, L3, L3]; why: L3 };   // the first option is always the right one; they are shuffled when asked
const BANK: Q[] = [
  { q: ["โน้ตตัวไหนอยู่สูงกว่า C ห่างกันคู่ห้าเพอร์เฟกต์?", "Which note is a perfect fifth above C?", "高于 C 的纯五度是哪个音？"], o: [["G", "G", "G"], ["F", "F", "F"], ["E", "E", "E"]], why: ["คู่ห้าเพอร์เฟกต์จาก C คือ G (C-D-E-F-G นับได้ห้าตัว) ห่างกัน 7 เสียงครึ่ง", "A perfect fifth above C is G: C-D-E-F-G is five letters and 7 semitones.", "C 上方纯五度是 G：C-D-E-F-G 共五个音名，相距 7 个半音。"] },
  { q: ["หนึ่งอ็อกเทฟมีกี่เสียงครึ่ง?", "How many semitones are in an octave?", "一个八度有多少个半音？"], o: [["12", "12", "12"], ["8", "8", "8"], ["10", "10", "10"]], why: ["หนึ่งอ็อกเทฟมี 12 เสียงครึ่ง ตามแป้นเปียโนขาวดำรวมกัน 12 คีย์", "An octave is 12 semitones: the 12 white and black keys of one cycle on the piano.", "一个八度是 12 个半音，也就是钢琴上黑白键加起来的 12 个键。"] },
  { q: ["คีย์ไมเนอร์คู่ขนานของ C เมเจอร์คือ?", "What is the relative minor of C major?", "C 大调的关系小调是？"], o: [["A ไมเนอร์", "A minor", "A 小调"], ["D ไมเนอร์", "D minor", "D 小调"], ["E ไมเนอร์", "E minor", "E 小调"]], why: ["คีย์ไมเนอร์คู่ขนานอยู่ต่ำลงมา 3 เสียงครึ่ง ใช้โน้ตชุดเดียวกัน C เมเจอร์จึงคู่กับ A ไมเนอร์", "The relative minor sits 3 semitones down and shares the same notes, so C major pairs with A minor.", "关系小调在下方 3 个半音处，用同一组音，所以 C 大调对应 A 小调。"] },
  { q: ["ไตรแอดหรือคอร์ดสามเสียงมีกี่โน้ต?", "How many notes does a triad have?", "三和弦有几个音？"], o: [["3", "3", "3"], ["4", "4", "4"], ["2", "2", "2"]], why: ["ไตรแอดซ้อนโน้ตสามตัว คือ รูท ที่สาม และที่ห้า เช่น C-E-G", "A triad stacks three notes: root, third and fifth, such as C-E-G.", "三和弦由三个音叠成：根音、三音和五音，如 C-E-G。"] },
  { q: ["จังหวะ 4/4 หมายถึงอะไร?", "What does 4/4 time mean?", "4/4 拍表示什么？"], o: [["หนึ่งห้องมี 4 จังหวะ ตัวละหนึ่งจังหวะคือโน้ตตัวดำ", "Four beats in a bar, a quarter note gets the beat", "每小节 4 拍，以四分音符为一拍"], ["หนึ่งห้องมี 3 จังหวะ", "Three beats in a bar", "每小节 3 拍"], ["เล่นเร็วมาก", "Play very fast", "要弹得很快"]], why: ["ตัวเลขบนคือจำนวนจังหวะต่อห้อง ตัวเลขล่างบอกว่าโน้ตตัวไหนนับเป็นหนึ่งจังหวะ", "The top number is beats per bar; the bottom says which note value gets one beat.", "上面的数字是每小节的拍数，下面的数字表示以哪种音符为一拍。"] },
  { q: ["ไวโอลินอยู่ในตระกูลเครื่องดนตรีอะไร?", "Which instrument family is the violin in?", "小提琴属于哪一类乐器？"], o: [["เครื่องสาย", "Strings", "弦乐器"], ["เครื่องเป่าลมไม้", "Woodwinds", "木管乐器"], ["เครื่องกระทบ", "Percussion", "打击乐器"]], why: ["ไวโอลิน วิโอลา เชลโล และดับเบิลเบส เป็นตระกูลเครื่องสายที่สีด้วยคันชัก", "Violin, viola, cello and double bass are the string family, played with a bow.", "小提琴、中提琴、大提琴和低音提琴都是弦乐器，用琴弓演奏。"] },
  { q: ["เครื่องหมายชาร์ป (♯) ทำอะไรกับโน้ต?", "What does a sharp (♯) do to a note?", "升号（♯）会让音怎么变？"], o: [["ทำให้สูงขึ้นครึ่งเสียง", "Raises it by a semitone", "升高半音"], ["ทำให้ต่ำลงครึ่งเสียง", "Lowers it by a semitone", "降低半音"], ["ทำให้ดังขึ้น", "Makes it louder", "让它更响"]], why: ["ชาร์ปยกเสียงขึ้นครึ่งเสียง ส่วนแฟลต (♭) ลดลงครึ่งเสียง", "A sharp raises the pitch by a semitone; a flat (♭) lowers it by a semitone.", "升号把音高升半音，降号（♭）把音高降半音。"] },
  { q: ["โน้ตตัวแรกของสเกล G เมเจอร์เรียกว่าอะไร และคือโน้ตอะไร?", "What is the first note of the G major scale called, and which note is it?", "G 大调音阶的第一个音叫什么？是哪个音？"], o: [["โทนิก คือ G", "The tonic, G", "主音，G"], ["โดมิแนนต์ คือ D", "The dominant, D", "属音，D"], ["ซับโดมิแนนต์ คือ C", "The subdominant, C", "下属音，C"]], why: ["โน้ตตัวแรกของสเกลเรียกว่าโทนิก เป็นบ้านของเพลง สเกล G เมเจอร์จึงเริ่มที่ G", "The first note of a scale is the tonic, the home of the tune; G major starts on G.", "音阶的第一个音叫主音，是乐曲的“家”，G 大调从 G 开始。"] },
  { q: ["คำว่า 'ฟอร์เต้' (forte) แปลว่า?", "What does 'forte' mean?", "“forte”是什么意思？"], o: [["เล่นดัง", "Play loudly", "强，弹得响"], ["เล่นเบา", "Play softly", "弱，弹得轻"], ["เล่นช้าลง", "Slow down", "渐慢"]], why: ["ฟอร์เต้ (f) คือดัง เปียโน (p) คือเบา ชื่อเครื่องดนตรีเปียโนมาจากการเล่นได้ทั้งเบาและดัง", "Forte (f) is loud and piano (p) is soft; the piano is named for playing both soft and loud.", "forte (f) 是强，piano (p) 是弱；钢琴之名正是因为它能弹出轻和重。"] },
  { q: ["บรรทัดห้าเส้นมีกี่เส้น?", "How many lines does a staff have?", "五线谱有几条线？"], o: [["5", "5", "5"], ["4", "4", "4"], ["6", "6", "6"]], why: ["บรรทัดห้าเส้นมี 5 เส้นและ 4 ช่อง โน้ตเขียนบนเส้นหรือในช่อง", "A staff has 5 lines and 4 spaces; notes sit on a line or in a space.", "五线谱有 5 条线 4 个间，音符写在线上或间里。"] },
  { q: ["คอร์ด C เมเจอร์ประกอบด้วยโน้ตอะไร?", "Which notes make a C major chord?", "C 大三和弦由哪些音组成？"], o: [["C E G", "C E G", "C E G"], ["C F A", "C F A", "C F A"], ["C D G", "C D G", "C D G"]], why: ["คอร์ดเมเจอร์ = รูท + ที่สามเมเจอร์ + ที่ห้าเพอร์เฟกต์ จึงเป็น C-E-G", "A major chord is root + major third + perfect fifth, so C-E-G.", "大三和弦 = 根音 + 大三度 + 纯五度，即 C-E-G。"] },
  { q: ["คำว่า 'ลาร์โก' (largo) บอกถึงอะไร?", "What does 'largo' tell the player?", "“largo”提示演奏者什么？"], o: [["ช้ามากและสง่า", "Very slow and broad", "极慢而宽广"], ["เร็วและสนุก", "Fast and lively", "快而活泼"], ["เบามาก", "Very quiet", "很轻"]], why: ["ลาร์โกคือสัญลักษณ์ความเร็วที่ช้ามาก ส่วนอัลเลโกรคือเร็วและร่าเริง", "Largo is a very slow tempo; allegro is fast and cheerful.", "largo 是很慢的速度术语，allegro 则是快速而欢快。"] },
  { q: ["หนึ่งเสียงเต็ม (whole step) เท่ากับกี่เสียงครึ่ง?", "A whole step equals how many semitones?", "一个全音等于几个半音？"], o: [["2", "2", "2"], ["1", "1", "1"], ["3", "3", "3"]], why: ["หนึ่งเสียงเต็มเท่ากับสองเสียงครึ่ง เช่น C ไป D", "A whole step is two semitones, for example C to D.", "一个全音等于两个半音，比如 C 到 D。"] },
  { q: ["กุญแจประจำหลักที่ใช้กับเสียงสูงของมือขวาเปียโนคือ?", "Which clef is normally used for the piano's right hand?", "钢琴右手通常使用哪种谱号？"], o: [["กุญแจซอล", "Treble clef", "高音谱号"], ["กุญแจฟา", "Bass clef", "低音谱号"], ["กุญแจโด", "C clef", "C 谱号"]], why: ["กุญแจซอลใช้กับเสียงสูง กุญแจฟาใช้กับเสียงต่ำที่มือซ้ายเล่น", "The treble clef is for higher notes; the bass clef is for the low notes of the left hand.", "高音谱号用于较高的音，低音谱号用于左手的低音。"] },
  { q: ["สเกลเมเจอร์มีรูปแบบระยะห่างเสียงเป็นอย่างไร?", "What is the step pattern of a major scale?", "大调音阶的音程排列是什么？"], o: [["เต็ม เต็ม ครึ่ง เต็ม เต็ม เต็ม ครึ่ง", "W W H W W W H", "全 全 半 全 全 全 半"], ["เต็ม ครึ่ง เต็ม เต็ม ครึ่ง เต็ม เต็ม", "W H W W H W W", "全 半 全 全 半 全 全"], ["ครึ่ง ครึ่ง เต็ม เต็ม เต็ม ครึ่ง เต็ม", "H H W W W H W", "半 半 全 全 全 半 全"]], why: ["สเกลเมเจอร์คือ เต็ม-เต็ม-ครึ่ง-เต็ม-เต็ม-เต็ม-ครึ่ง ถ้าใช้กับโน้ตตัวไหนก็ได้เสียงสเกลเมเจอร์", "A major scale is whole-whole-half-whole-whole-whole-half, from any starting note.", "大调音阶的排列是全全半全全全半，从任何音开始都成立。"] },
  { q: ["โน้ตตัวดำสองตัวรวมเป็นโน้ตตัวอะไร?", "Two quarter notes add up to which note?", "两个四分音符加起来等于什么音符？"], o: [["โน้ตตัวขาวหนึ่งตัว", "One half note", "一个二分音符"], ["โน้ตตัวกลมหนึ่งตัว", "One whole note", "一个全音符"], ["โน้ตเขบ็จสองชั้น", "A sixteenth note", "一个十六分音符"]], why: ["ตัวดำหนึ่งจังหวะ สองตัวจึงเป็นสองจังหวะ เท่ากับตัวขาวหนึ่งตัว", "A quarter note gets one beat, so two make two beats, the length of a half note.", "四分音符一拍，两个就是两拍，等于一个二分音符。"] },
  { q: ["ใครแต่งเพลง 'Für Elise'?", "Who composed 'Für Elise'?", "《致爱丽丝》的作曲家是谁？"], o: [["เบโธเฟน", "Beethoven", "贝多芬"], ["โมสาร์ท", "Mozart", "莫扎特"], ["บาค", "Bach", "巴赫"]], why: ["Für Elise เป็นผลงานเปียโนเล็ก ๆ ของลุดวิก ฟาน เบโธเฟน เมื่อราว ค.ศ. 1810", "Für Elise is a small piano piece by Ludwig van Beethoven from around 1810.", "《致爱丽丝》是贝多芬约 1810 年写的钢琴小曲。"] },
  { q: ["คอร์ดโดมิแนนต์สร้างบนโน้ตขั้นที่เท่าไรของสเกล?", "On which scale degree is the dominant chord built?", "属和弦建立在音阶的第几级上？"], o: [["ขั้นที่ 5", "The 5th", "第 5 级"], ["ขั้นที่ 4", "The 4th", "第 4 级"], ["ขั้นที่ 2", "The 2nd", "第 2 级"]], why: ["โดมิแนนต์คือขั้นที่ 5 มันดึงเสียงให้กลับไปบ้านที่โทนิก ใน C เมเจอร์คือ G", "The dominant is the 5th degree; it pulls back to the tonic. In C major that is G.", "属音是第 5 级，它会把乐句拉回主音；在 C 大调里是 G。"] },
  { q: ["ที่สามไมเนอร์ห่างกันกี่เสียงครึ่ง?", "How many semitones are in a minor third?", "小三度包含几个半音？"], o: [["3", "3", "3"], ["4", "4", "4"], ["2", "2", "2"]], why: ["ที่สามไมเนอร์ 3 เสียงครึ่ง (C ถึง E♭) ที่สามเมเจอร์ 4 เสียงครึ่ง (C ถึง E)", "A minor third is 3 semitones (C to E♭); a major third is 4 (C to E).", "小三度是 3 个半音（C 到 E♭），大三度是 4 个（C 到 E）。"] },
];
const rngPick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const NAMES = ["Kiko", "Bolt", "Nova", "Zed"];
const careerNow = () => { try { return localStorage.getItem("tg_adv_career") || ""; } catch (e) { return ""; } };

type Ask = { q: string; opts: { label: string; ok: boolean }[]; why: string; tier: number };
function makeAsk(lang: string, used: Set<string>): Ask {
  // half the time ask what this learner has studied (choice questions only), otherwise from the bank
  if (Math.random() < 0.5) { try { const r = nextQuestion(lang as any); if (r && r.q && r.q.kind === "choice" && r.q.opts && r.q.opts.length >= 2 && !used.has(r.q.id + r.q.q)) { used.add(r.q.id + r.q.q); return { q: r.q.q, opts: r.q.opts.map(o => ({ label: o.label, ok: o.ok })), why: r.q.teach.why, tier: r.q.tier }; } } catch (e) {} }
  const pool = BANK.filter((_, i) => !used.has("b" + i)); const list = pool.length ? pool : BANK; const q = rngPick(list); used.add("b" + BANK.indexOf(q));
  const li = lang === "th" ? 0 : lang === "zh" ? 2 : 1;
  return { q: q.q[li], opts: shuffle(q.o.map((o, i) => ({ label: o[li], ok: i === 0 }))), why: q.why[li], tier: 1 };
}

export default function AdventureBuild({ P, lang, onWin, onExit, onRetry }: any) {
  const sc: Scn = SCENARIOS[P.kind] || SCENARIOS.ship, t = (a: string, b: string, c: string) => T3(lang, a, b, c), N = sc.parts.length;
  const G = useRef<any>(null);
  if (!G.current) G.current = { built: 0, phase: "ask" as "ask" | "teach" | "build", ask: null as any, picked: -1, bp: 0, miss: 0, right: 0, used: new Set<string>(), notes: [] as string[], t: 0, ended: false, won: false, bot: 0 };
  const S = G.current; if (!S.ask) S.ask = makeAsk(lang, S.used);
  const askAt = new Set([0, Math.round((N - 1) / 2), N - 1]);   // owner 2026-10-15: only THREE questions in a whole construction, the rest builds by itself
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth * 1.05);
  useEffect(() => { const f = () => setPortrait(window.innerHeight > window.innerWidth * 1.05); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null);
  const career = careerNow(), speed = career === "ship" ? 0.6 : career === "eng" ? 0.8 : 1, BUILD_S = 3.4 * speed;
  useEffect(() => {
    try { enterFs(); } catch (e) {} const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return;
      S.t += dt;
      if (S.phase === "build") { S.bp += dt / BUILD_S * 100; if (S.bp >= 100) { S.bp = 0; S.built++; S.bot = (S.bot + 1) % NAMES.length; sfx.play("win");
          if (S.built >= N) { S.won = true; S.ended = true; const stars = S.miss === 0 ? 3 : S.miss === 1 ? 2 : 1; setTimeout(() => { try { const b = JSON.parse(localStorage.getItem("tg_adv_built") || "[]"); if (!b.includes(P.kind)) { b.push(P.kind); localStorage.setItem("tg_adv_built", JSON.stringify(b)); } } catch (e) {} onWin({ build: { kind: P.kind, parts: N, miss: S.miss, right: S.right, stars, notes: S.notes.length }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "build" }); }, 2600); }
          else if (askAt.has(S.built)) { S.phase = "ask"; S.ask = makeAsk(lang, S.used); S.picked = -1; } } }
      setTick(x => (x + 1) % 1e6);
    }, 100);
    (window as any).__advBuild = { state: () => ({ built: S.built, N, phase: S.phase, miss: S.miss, right: S.right, notes: S.notes.length, won: S.won, ended: S.ended, kind: P.kind }), answerRight: () => { const i = S.ask.opts.findIndex((o: any) => o.ok); pick(i); }, answerWrong: () => { const i = S.ask.opts.findIndex((o: any) => !o.ok); pick(i); }, tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) { if (S.phase === "build") { S.bp += 0.1 / BUILD_S * 100; if (S.bp >= 100) { S.bp = 0; S.built++; if (S.built >= N) { S.won = true; S.ended = true; return; } if (askAt.has(S.built)) { S.phase = "ask"; S.ask = makeAsk(lang, S.used); S.picked = -1; } } } } } };
    return () => { clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advBuild; } catch (e) {} };
  }, []);
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const pick = (i: number) => {
    if (S.phase !== "ask" || S.ended) return; const o = S.ask.opts[i]; if (!o) return; S.picked = i; S.notes.push(S.ask.why);
    if (o.ok) { S.right++; S.phase = "build"; S.bp = 0; play("pickup"); } else { S.miss++; S.phase = "teach"; play("hurt"); }
    setTick(x => x + 1);
  };
  const again = () => { S.phase = "build"; S.bp = 0; S.picked = -1; setTick(x => x + 1); };   // after the lesson the crew builds the part anyway: no second question
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const cur = Math.min(S.built, N - 1), part = sc.parts[cur], out = Math.round(S.built * sc.per * 10) / 10, pct = Math.round((S.built + (S.phase === "build" ? S.bp / 100 : 0)) / N * 100);
  const stars = S.miss === 0 ? 3 : S.miss === 1 ? 2 : 1;
  return (
    <div className={"adv-farm adv-build abf" + (portrait ? " rot" : "")} data-build={P.kind}><div className="abf-in">
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{sc.icon} {T3(lang, sc.title[0], sc.title[1], sc.title[2])} · {t("ชิ้นส่วน ", "Parts ", "部件 ")}{S.built}/{N} · ✓ {S.right} · ✗ {S.miss}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{T3(lang, sc.out[0], sc.out[1], sc.out[2])}: {out}{sc.unit} · {pct}%</b></div>
        </div>
        <GearButton onClick={openGear} />
      </div>
      <svg className="ab-view" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet" role="img" aria-label="build">
        <defs>
          <linearGradient id="abg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sc.sky[0]} /><stop offset="1" stopColor={sc.sky[1]} /></linearGradient>
          <radialGradient id="abn1" cx=".25" cy=".3" r=".6"><stop offset="0" stopColor="#7a4bff" stopOpacity=".38" /><stop offset="1" stopColor="#7a4bff" stopOpacity="0" /></radialGradient>
          <radialGradient id="abn2" cx=".8" cy=".7" r=".55"><stop offset="0" stopColor="#19e6ff" stopOpacity=".3" /><stop offset="1" stopColor="#19e6ff" stopOpacity="0" /></radialGradient>
          <linearGradient id="abm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2f6fb" /><stop offset=".5" stopColor="#aab4c2" /><stop offset="1" stopColor="#5b6573" /></linearGradient>
          <radialGradient id="abp" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe9b8" /><stop offset=".6" stopColor="#c98a4a" /><stop offset="1" stopColor="#5a3418" /></radialGradient>
          <radialGradient id="abs" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fffbe0" /><stop offset=".4" stopColor="#ffd25a" /><stop offset="1" stopColor="#ff9a2a" stopOpacity="0" /></radialGradient>
          <filter id="abglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <pattern id="abgrid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#19e6ff" strokeOpacity=".07" strokeWidth=".3" /></pattern>
        </defs>
        <rect x="-40" y="-30" width="240" height="150" fill="url(#abg)" />
        <rect x="-40" y="-30" width="240" height="150" fill="url(#abn1)" /><rect x="-40" y="-30" width="240" height="150" fill="url(#abn2)" />
        {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={((i * 37) % 200) - 20} cy={((i * 53) % 120) - 15} r={0.25 + (i % 4) * 0.12} fill="#fff" opacity={0.3 + (i % 5) * 0.12}><animate attributeName="opacity" values=".25;.9;.25" dur={(2 + (i % 5)) + "s"} repeatCount="indefinite" /></circle>)}
        <rect width="160" height="90" fill="url(#abgrid)" />
        {P.kind === "dyson" && <g><circle cx="80" cy="45" r="30" fill="url(#abs)" opacity=".8" /><circle cx="80" cy="45" r="9" fill="#fff6c8" filter="url(#abglow)" /><ellipse cx="80" cy="45" rx="52" ry="34" fill="none" stroke="#ffd25a" strokeOpacity=".35" strokeDasharray="2 3" /><ellipse cx="80" cy="45" rx="38" ry="24" fill="none" stroke="#19e6ff" strokeOpacity=".25" strokeDasharray="1 3" /></g>}
        {P.kind === "gas" && <g><circle cx="80" cy="110" r="78" fill="url(#abp)" /><path d="M6 80 Q80 66 154 80 M10 88 Q80 74 150 88 M14 74 Q80 62 146 74" stroke="#f6d8a0" strokeWidth="2.2" fill="none" opacity=".55" /><ellipse cx="80" cy="45" rx="70" ry="9" fill="none" stroke="#fff" strokeOpacity=".15" /></g>}
        {P.kind === "mine" && <g><path d="M40 52 Q46 20 80 16 Q120 18 128 50 Q124 78 82 80 Q44 80 40 52Z" fill="#454552" stroke="#9a9aae" strokeWidth=".6" /><path d="M48 40 Q64 22 92 24" stroke="#fff" strokeOpacity=".22" strokeWidth="1.6" fill="none" /><circle cx="66" cy="42" r="5.5" fill="#2c2c36" /><circle cx="98" cy="60" r="8" fill="#2c2c36" /><circle cx="88" cy="32" r="3" fill="#2c2c36" /><circle cx="110" cy="46" r="2" fill="#ffb347" opacity=".9" filter="url(#abglow)" /></g>}
        {P.kind === "ship" && <g><path d="M16 45 L42 28 L122 32 L146 45 L122 58 L42 62Z" fill="url(#abm)" fillOpacity={0.12 + 0.55 * S.built / N} stroke="#7fa6ff" strokeOpacity=".7" strokeWidth=".5" strokeDasharray={S.built >= N ? "" : "2 2"} /><path d="M42 28 L122 32" stroke="#fff" strokeOpacity={0.15 + 0.5 * S.built / N} strokeWidth=".8" /></g>}
        {sc.parts.map((p, i) => { const done = i < S.built, now = i === S.built && S.phase === "build", pr = now ? S.bp / 100 : 0; return (
          <g key={i} data-part={i} className={done ? "ab-done" : now ? "ab-now" : "ab-todo"} transform={`translate(${p.x} ${p.y})`}>
            {done && <circle r="11" fill="#5affbe" opacity=".12" filter="url(#abglow)" />}
            <circle r="8.2" fill={done ? "url(#abm)" : "rgba(10,20,50,.55)"} stroke={done ? "#5affbe" : now ? "#ffe07a" : "rgba(130,190,255,.5)"} strokeWidth={done || now ? 1.1 : 0.6} strokeDasharray={done ? "" : "2 2"} filter={done || now ? "url(#abglow)" : undefined} />
            {now && <circle r="8.2" fill="none" stroke="#ffe07a" strokeWidth="1.6" strokeDasharray={`${pr * 51.5} 60`} transform="rotate(-90)" />}
            <text textAnchor="middle" y="3.6" fontSize="9" opacity={done ? 1 : now ? 0.95 : 0.4}>{p.icon}</text>
          </g>); })}
        {S.phase === "build" && <g transform={`translate(${part.x + 11} ${part.y - 9})`} className="ab-bot"><text fontSize="9">🤖</text><text fontSize="6" y="-1" x="2">✨</text></g>}
        {S.phase === "build" && <line x1={part.x + 10} y1={part.y - 7} x2={part.x} y2={part.y} stroke="#ffe07a" strokeWidth=".8" strokeOpacity=".85" filter="url(#abglow)"><animate attributeName="stroke-opacity" values=".3;1;.3" dur=".5s" repeatCount="indefinite" /></line>}
      </svg>
      <div className="ab-crew">{NAMES.map((n, i) => (<span key={n} className={"ab-r" + (S.phase === "build" && i === S.bot ? " on" : "")}>🤖 {n}</span>))}<span className="ab-say">{S.phase === "build" ? t(NAMES[S.bot] + " กำลังประกอบ: ", NAMES[S.bot] + " is building: ", NAMES[S.bot] + " 正在组装：") + T3(lang, part.name[0], part.name[1], part.name[2]) : t("ลูกเรือหุ่นยนต์รอคำตอบของคุณ เพื่อเริ่มประกอบ: ", "The robot crew needs your answer before they can build: ", "机器人团队等你回答后才能开工：") + T3(lang, part.name[0], part.name[1], part.name[2])}</span></div>
      {S.phase === "build" && <div className="af-bar ab-prog"><i style={{ width: S.bp + "%" }} /></div>}
      {(S.phase === "ask" || S.phase === "teach") && !S.won && (
        <div className="ab-q" data-ask="1">
          <div className="ab-qh">🎵 {t("คำถามดนตรี", "MUSIC QUESTION", "音乐问题")} · {t("ชิ้นส่วนที่ ", "part ", "第 ")}{S.built + 1}{lang === "zh" ? " 个部件" : ""}</div>
          <div className="ab-qq">{S.ask.q}</div>
          <div className="ab-opts">{S.ask.opts.map((o: any, i: number) => (<button key={i} data-opt={i} className={"adv-qopt" + (S.phase === "teach" ? (o.ok ? " ok" : S.picked === i ? " no" : "") : "")} disabled={S.phase === "teach"} onClick={() => pick(i)}>{o.label}</button>))}</div>
          {S.phase === "teach" && <div className="adv-qres bad" data-teach="1"><b>{t("ยังไม่ใช่ — มาเรียนรู้กัน", "Not quite — let us learn it", "不对——我们来学一学")}</b><br />{S.ask.why}<br /><button className="adv-qgo" data-again="1" onClick={again}>{t("ต่อ — เริ่มประกอบ", "Continue — start building", "继续——开始组装")}</button></div>}
        </div>)}
      {S.phase === "build" && S.notes.length > 0 && <div className="af-fact">💡 {S.notes[S.notes.length - 1]}</div>}
      {S.ended && S.won && (<div className="adv-clear" role="status"><b>{sc.icon} {t("ก่อสร้างเสร็จสมบูรณ์!", "Construction complete!", "建造完成！")}</b>
        <span>{T3(lang, sc.out[0], sc.out[1], sc.out[2])}: {out}{sc.unit} · {"★".repeat(stars)}</span>
        <small>{t("สมุดบันทึกดนตรี: เรียนรู้แล้ว ", "Music notebook: learned ", "音乐笔记：已学 ")}{S.notes.length}{t(" ข้อ", " facts", " 条")}</small></div>)}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div></div>
  );
}
