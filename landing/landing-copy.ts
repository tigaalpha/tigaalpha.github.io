/* ── landing/landing-copy.ts ──
   Every string on marketing landing page 1, in the app's three languages.

   Deliberately NOT imported from i18n.ts. That file is 227 kB covering every
   screen in the product, and this page's whole reason for existing is that an
   ad click downloads almost nothing. These are the ~50 strings this page
   actually paints, and the three flags, which is all it needs. ── */

export const LANGS = ["th", "en", "zh"];
export const FLAGS = { th: "🇹🇭", en: "🇬🇧", zh: "🇨🇳" };   // same three as the app's settings panel
export const FLAG_NAMES = { th: "ไทย", en: "English", zh: "中文" };

/* ── Thai on arrival. Always. ──
   This used to read navigator.language, which sounds helpful and was wrong
   here: a large share of phones in Thailand are set to English, so Thai
   visitors arriving from a Thai-language ad were greeted in English — a
   worse first impression than no detection at all, and on the one screen
   where the first impression is the entire job.

   The flags are right there if somebody wants another language, and a choice
   they actually made is remembered below. Nothing guesses on their behalf. */
export function pickLang(stored) {
  if (LANGS.includes(stored)) return stored;   // they picked before — honour it
  return "th";
}

export const C = {
  th: {
    htmlTitle: "ลองเรียนเปียโนกับครู AI — TIGA",
    kicker: "ครูเปียโน AI",
    h1a: "ถามครูเปียโน AI แล้วดูมัน",
    h1b: "เล่นให้ดูบนคีย์จริง",
    sub: "กดคีย์ข้างล่างได้เลย — ไม่ต้องสมัคร ไม่ต้องโหลดอะไรทั้งนั้น เลือกคำถามสักข้อ แล้ว TIGA จะอธิบายพร้อมเล่นให้ดูทีละนิ้ว",
    tapHint: "👆 ลองกดดูสิ",
    greet: "สวัสดีครับ ผมคือ TIGA ครูเปียโน AI 🎹\nอยากให้สอนเรื่องไหนก่อนดีครับ? เลือกได้เลย — ตอบทันที ไม่ต้องสมัครสมาชิก",
    chipHint: "แตะสักข้อ แล้วดูคีย์บอร์ดข้างบน",
    askPh: "ถาม TIGA ได้เลย เช่น มือซ้ายกับมือขวาเล่นพร้อมกันไม่ได้…",
    askBtn: "ถาม",
    askFree: "ถามฟรีได้อีก {n} คำถาม — ตอบโดย AI จริง ไม่ต้องสมัคร",
    askThinking: "TIGA กำลังคิด…",
    askFailed: "ขอโทษครับ ตอนนี้ตอบไม่ได้ ลองถามอีกครั้งได้ไหมครับ",
    askQuotaTitle: "ถามต่อได้ไม่จำกัด 🎹",
    sticky: "สมัครฟรี — ถามได้ไม่จำกัด",
    proof1: "เพลงให้เล่นตาม", proof2: "ถามได้ทุกเรื่อง", proof3: "ไม่ต้องใช้บัตร",
    signupTitleQ: "คำถามของคุณพร้อมแล้ว 🎹",
    signupTitle: "เปิดห้องเรียนของคุณเอง 🎹",
    signupBody: "สี่คำตอบเมื่อกี้เป็นบทเรียนสำเร็จรูป — ของจริงคือ TIGA ตอบคำถามของคุณเองได้ไม่จำกัด จำได้ว่าคุณติดตรงไหน และเลือกแบบฝึกให้ตรงจุดอ่อน สมัครฟรี ไม่ต้องใช้บัตร",
    qLabel: "คำถามที่คุณถาม",
    google: "สมัคร / เข้าสู่ระบบด้วย Google",
    or: "หรือ",
    emailBtn: "สมัครด้วยอีเมล",
    inApp: "คุณกำลังเปิดจากในแอปอื่น (Facebook / LINE / IG) ซึ่งปุ่ม Google มักใช้ไม่ได้ — สมัครด้วยอีเมลข้างล่างได้เลย หรือกดเปิดในเบราว์เซอร์จริงก่อน",
    namePh: "ชื่อที่อยากให้ครูเรียก",
    emailPh: "อีเมล",
    passPh: "รหัสผ่าน (อย่างน้อย 6 ตัว)",
    agree: "ฉันยอมรับ", agreeLink: "นโยบายความเป็นส่วนตัว",
    agreeTail: " และยินยอมให้เก็บข้อมูลเพื่อให้บริการเรียนเปียโน",
    marketing: "ยินดีรับข่าวสารและโปรโมชัน (ไม่บังคับ)",
    submit: "สมัครฟรี", submitBusy: "กำลังสมัคร…",
    useGoogle: "ใช้ Google แทน",
    openReal: "เปิดในเบราว์เซอร์จริง",
    have: "มีบัญชีอยู่แล้ว?", haveLink: "เข้าสู่ระบบในแอป",
    footTag: "TIGA AI · เรียนเปียโนกับครู AI",
    enterApp: "เข้าแอปเลย", privacy: "นโยบายความเป็นส่วนตัว",
    errName: "กรุณากรอกชื่อที่อยากให้ครูเรียก · Please enter a name",
    errFields: "กรุณากรอกอีเมลและรหัสผ่าน · Please enter your email and password",
    errShort: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร · Password must be at least 6 characters",
    errAgree: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร · Please accept the privacy notice to continue",
    done: "สมัครสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ · Account created — check your email to confirm it, then log in.",
  },

  en: {
    htmlTitle: "Try a piano lesson with an AI teacher — TIGA",
    kicker: "AI PIANO TEACHER",
    h1a: "Ask an AI piano teacher, and watch it ",
    h1b: "play the answer on real keys",
    sub: "Play the keyboard below right now — no sign-up, nothing to install. Pick a question and TIGA explains it while playing it for you, finger by finger.",
    tapHint: "👆 Tap a key",
    greet: "Hi, I'm TIGA — your AI piano teacher 🎹\nWhat would you like me to teach you first? Pick one — answered instantly, no account needed.",
    chipHint: "Tap one, then watch the keyboard above",
    askPh: "Ask TIGA anything — e.g. my hands won't play together…",
    askBtn: "Ask",
    askFree: "{n} free questions left — answered by the real AI, no account",
    askThinking: "TIGA is thinking…",
    askFailed: "Sorry — I couldn't answer just then. Try asking again?",
    askQuotaTitle: "Keep asking, without limit 🎹",
    sticky: "Sign up free — ask anything, unlimited",
    proof1: "songs to play along to", proof2: "ask it anything", proof3: "no card needed",
    signupTitleQ: "Your question is ready 🎹",
    signupTitle: "Open your own classroom 🎹",
    signupBody: "Those four answers are ready-made lessons. The real thing is TIGA answering your own questions, with no limit — remembering where you got stuck and picking exercises for exactly that. Free, no card needed.",
    qLabel: "The question you asked",
    google: "Sign up / log in with Google",
    or: "or",
    emailBtn: "Sign up with email",
    inApp: "You've opened this inside another app (Facebook / LINE / IG), where the Google button usually can't work — sign up with email below, or open this in your real browser first.",
    namePh: "What should your teacher call you?",
    emailPh: "Email",
    passPh: "Password (at least 6 characters)",
    agree: "I accept the ", agreeLink: "privacy notice",
    agreeTail: " and consent to my data being used to provide piano lessons",
    marketing: "Send me news and offers (optional)",
    submit: "Sign up free", submitBusy: "Signing you up…",
    useGoogle: "Use Google instead",
    openReal: "Open in a real browser",
    have: "Already have an account?", haveLink: "Log in inside the app",
    footTag: "TIGA AI · learn piano with an AI teacher",
    enterApp: "Go to the app", privacy: "Privacy notice",
    errName: "Please enter a name",
    errFields: "Please enter your email and password",
    errShort: "Password must be at least 6 characters",
    errAgree: "Please accept the privacy notice to continue",
    done: "Account created — check your email to confirm it, then log in.",
  },

  zh: {
    htmlTitle: "和 AI 钢琴老师试上一课 — TIGA",
    kicker: "AI 钢琴老师",
    h1a: "问 AI 钢琴老师，看它",
    h1b: "在真实琴键上弹给你看",
    sub: "下面的琴键现在就能弹——不用注册，不用下载。挑一个问题，TIGA 会一边讲解一边一个音一个音弹给你看。",
    tapHint: "👆 点一下试试",
    greet: "你好，我是 TIGA，你的 AI 钢琴老师 🎹\n想先学哪一个？随便挑——马上回答，不用注册。",
    chipHint: "点一个，然后看上面的键盘",
    askPh: "随便问 TIGA — 例如：左右手合不起来怎么办…",
    askBtn: "问",
    askFree: "还能免费问 {n} 个问题 —— 由真正的 AI 回答，无需注册",
    askThinking: "TIGA 正在思考…",
    askFailed: "抱歉，刚才没能回答。再问一次好吗？",
    askQuotaTitle: "无限次提问 🎹",
    sticky: "免费注册 — 无限提问",
    proof1: "首曲子可跟弹", proof2: "什么都能问", proof3: "无需银行卡",
    signupTitleQ: "你的问题准备好了 🎹",
    signupTitle: "开一间属于你的教室 🎹",
    signupBody: "刚才那四个回答是现成的课程。真正厉害的是 TIGA 能无限回答你自己的问题，记住你卡在哪里，并针对你的弱项挑练习。免费注册，无需银行卡。",
    qLabel: "你问的问题",
    google: "用 Google 注册 / 登录",
    or: "或",
    emailBtn: "用邮箱注册",
    inApp: "你是从别的 App（Facebook / LINE / IG）里打开的，Google 按钮在这里通常无法使用——请用下面的邮箱注册，或先在真正的浏览器中打开。",
    namePh: "希望老师怎么称呼你？",
    emailPh: "邮箱",
    passPh: "密码（至少 6 位）",
    agree: "我接受", agreeLink: "隐私政策",
    agreeTail: "，并同意为提供钢琴教学而使用我的数据",
    marketing: "接收消息与优惠（选填）",
    submit: "免费注册", submitBusy: "注册中…",
    useGoogle: "改用 Google",
    openReal: "在真正的浏览器中打开",
    have: "已经有账号？", haveLink: "在 App 中登录",
    footTag: "TIGA AI · 跟 AI 老师学钢琴",
    enterApp: "进入 App", privacy: "隐私政策",
    errName: "请输入一个名字",
    errFields: "请输入邮箱和密码",
    errShort: "密码至少需要 6 个字符",
    errAgree: "请先接受隐私政策才能注册",
    done: "注册成功！请查收邮件确认账号，然后回来登录。",
  },
};
