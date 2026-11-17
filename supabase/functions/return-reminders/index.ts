// Day-1 / 3 / 7 "come back" nudges (users report 2026-10-02, platform rec #3).
//
// The report's numbers: of the 51 accounts made since 7 Sep only 5 were ever active on a second
// day, none of the 31 older than a week was back in the last 7 days, and the only way to reach
// them was web push — which 2 people had switched on. This function sends ONE short push to a
// person who signed up exactly 1, 3 or 7 days ago, holds a push subscription (their own browser
// permission is the consent) and has not opened the app today. Each (user, day) is sent once,
// ever (return_reminders_log). It also drops the same words in the in-app inbox (notifications).
//
// Off by default: gated on app_settings.return_reminders.enabled, so deploying this function and
// scheduling the cron job is inert until an admin flips the switch — the same convention as
// weekly-report. Called ONLY by a pg_cron job (verify_jwt:false + x-cron-secret).
//
// DEPLOYED with the owner's approval (v2 on 2026-11-13; ten languages on 2026-11-17). AGENTS.md hard rule: an edge function is
// deployed only with the owner's explicit approval. Files: supabase-return-reminders-migration.sql (table + switch + cron), then
// `supabase functions deploy return-reminders --no-verify-jwt`, set CRON_SECRET / VAPID_* secrets.
//
// LINE and e-mail are NOT wired here: they need a LINE Official Account channel token / an e-mail
// provider, which the owner has not set up. When they exist, add them beside the push below and
// send only to people whose profiles.marketing_consent is true.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

type Lang = "th" | "en" | "zh" | "ja" | "ko" | "ru" | "hi" | "es" | "fr" | "ar";
const MSG: Record<number, Record<Lang, { t: string; b: string }>> = {
  1: {
    th: { t: "เพลงประจำวันใหม่รออยู่ 🎵", b: "เล่นเพลงเดียวใน 1 นาที รับเหรียญและ EXP ของวันนี้" },
    en: { t: "A new daily song is waiting 🎵", b: "One song, about a minute — today's coins and EXP are yours" },
    zh: { t: "新的每日歌曲在等你 🎵", b: "只弹一首，约 1 分钟——今天的金币和经验归你" },
    ja: { t: "新しいデイリーソングが待っています 🎵", b: "1曲弾くだけ、約1分。今日のコインとEXPがもらえます" },
    ko: { t: "새로운 오늘의 곡이 기다리고 있어요 🎵", b: "딱 한 곡, 1분 정도면 돼요 — 오늘의 코인과 EXP를 챙겨 가세요" },
    ru: { t: "Новая песня дня уже ждёт 🎵", b: "Одна песня, около минуты — и можно забрать монеты и EXP за сегодня" },
    hi: { t: "रोज़ का नया गाना आपका इंतज़ार कर रहा है 🎵", b: "बस एक गाना, करीब 1 मिनट — आज के सिक्के और EXP आपके हो जाएँगे" },
    es: { t: "Te espera una nueva canción del día 🎵", b: "Una sola canción, un minuto más o menos: las monedas y la EXP de hoy son tuyas" },
    fr: { t: "Une nouvelle chanson du jour t'attend 🎵", b: "Une seule chanson, environ une minute : les pièces et l'EXP du jour sont à toi" },
    ar: { t: "أغنية يومية جديدة بانتظارك 🎵", b: "اعزف أغنية واحدة في دقيقة تقريبًا، واكسب عملات اليوم وEXP" },
  },
  3: {
    th: { t: "เล่นต่อจากที่ค้างไว้ไหม 🎹", b: "ลองเพลงที่สอง — ได้ดาวเพิ่ม และเห็นว่าคุณเก่งขึ้นแล้ว" },
    en: { t: "Pick up where you left off 🎹", b: "Try a second song — more stars, and you'll hear yourself improve" },
    zh: { t: "接着上次继续弹吧 🎹", b: "试试第二首歌——多拿星星，也能听出自己进步了" },
    ja: { t: "前回の続きから弾いてみませんか 🎹", b: "2曲目に挑戦してみましょう。星がもっと増えて、自分の上達も耳で実感できます" },
    ko: { t: "하던 곳에서 이어서 연주해 볼까요? 🎹", b: "두 번째 곡에 도전해 보세요 — 별을 더 모으고, 연주가 좋아지는 걸 직접 들을 수 있어요" },
    ru: { t: "Продолжим с того места, где остановились? 🎹", b: "Попробуйте вторую песню — заработаете больше звёзд и услышите, как играете всё лучше" },
    hi: { t: "जहाँ छोड़ा था, वहीं से शुरू करें 🎹", b: "एक और गाना आज़माएँ — ज़्यादा स्टार मिलेंगे, और अपने बजाने में सुधार आपको खुद सुनाई देगा" },
    es: { t: "Continúa donde lo dejaste 🎹", b: "Prueba una segunda canción: ganarás más estrellas y escucharás cómo mejoras" },
    fr: { t: "Reprends là où tu en étais 🎹", b: "Essaie une deuxième chanson : plus d'étoiles à gagner, et tu t'entendras progresser" },
    ar: { t: "أكمل من حيث توقفت 🎹", b: "جرّب أغنية ثانية — ستجمع المزيد من النجوم وتسمع كيف يتحسّن عزفك" },
  },
  7: {
    th: { t: "ครบสัปดาห์แรกแล้ว 🌟", b: "มาดูว่าคุณเก่งขึ้นแค่ไหน แล้วเริ่มสัปดาห์ใหม่ด้วยเพลงเดียว" },
    en: { t: "Your first week is done 🌟", b: "See how far you've come, then start week two with a single song" },
    zh: { t: "第一周完成啦 🌟", b: "看看你进步了多少，然后用一首歌开启第二周" },
    ja: { t: "最初の1週間を終えました 🌟", b: "どれだけ上達したか見てみましょう。2週目は、たった1曲から始めましょう" },
    ko: { t: "첫 주를 마쳤어요 🌟", b: "그동안 얼마나 성장했는지 확인하고, 2주 차는 딱 한 곡으로 시작해 보세요" },
    ru: { t: "Первая неделя позади 🌟", b: "Посмотрите, какой путь уже пройден, и начните вторую неделю с одной песни" },
    hi: { t: "आपका पहला हफ़्ता पूरा हुआ 🌟", b: "देखें कि आपने कितना सफ़र तय कर लिया है, फिर बस एक गाने से दूसरा हफ़्ता शुरू करें" },
    es: { t: "¡Completaste tu primera semana! 🌟", b: "Mira cuánto has avanzado y empieza tu segunda semana con una sola canción" },
    fr: { t: "Ta première semaine est terminée 🌟", b: "Regarde tout le chemin parcouru, puis démarre ta deuxième semaine avec une seule chanson" },
    ar: { t: "اكتمل أسبوعك الأول 🌟", b: "انظر كم تقدّمت، ثم ابدأ الأسبوع الثاني بأغنية واحدة فقط" },
  },
};


// The language a person is written to: their own when this table has it (ja ko ru hi es fr ar joined th en zh on 2026-11-17; before that
// they got the English text), Thai when the profile has no language at all (as it always was), English for a language not in the table.
const pickLang = (l: string | null | undefined): Lang => (!l || l === "th") ? "th" : (["en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"] as string[]).includes(l) ? (l as Lang) : "en";

const DAY_MS = 86400000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "return_reminders").maybeSingle();
  const cfg = (setting && setting.value) as { enabled?: boolean; days?: number[] } | null;
  if (!cfg || !cfg.enabled) return json({ skipped: "disabled" });
  const days = (Array.isArray(cfg.days) ? cfg.days : [1, 3, 7]).filter((d) => MSG[d]);

  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "VAPID keys not configured yet" }, 500);
  webpush.setVapidDetails("mailto:admin@tigaalpha.github.io", VAPID_PUBLIC, VAPID_PRIVATE);

  const now = Date.now();
  const totals = { candidates: 0, sent: 0, pruned: 0, failed: 0, skippedActive: 0, skippedNoPush: 0 };

  for (const d of days) {
    // accounts created in [d, d+1) days ago: each person falls in each window exactly once
    const from = new Date(now - (d + 1) * DAY_MS).toISOString();
    const to = new Date(now - d * DAY_MS).toISOString();
    const { data: people, error } = await supabase.from("profiles")
      .select("id, lang").eq("banned", false).gte("created_at", from).lt("created_at", to);
    if (error) return json({ error: error.message }, 500);
    const ids = (people || []).map((p) => p.id as string);
    if (!ids.length) continue;
    totals.candidates += ids.length;

    // already sent this day, and anyone who has been in the app in the last 20 hours
    const [{ data: logged }, { data: active }, { data: subsAll }] = await Promise.all([
      supabase.from("return_reminders_log").select("user_id").eq("day", d).in("user_id", ids),
      supabase.from("usage_events").select("user_id").in("user_id", ids).gte("created_at", new Date(now - 20 * 3600000).toISOString()),
      supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", ids),
    ]);
    const done = new Set((logged || []).map((r) => r.user_id as string));
    const busy = new Set((active || []).map((r) => r.user_id as string));
    const subsBy = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
    for (const s of subsAll || []) {
      const k = s.user_id as string;
      if (!subsBy.has(k)) subsBy.set(k, []);
      subsBy.get(k)!.push(s as { endpoint: string; p256dh: string; auth: string });
    }

    for (const p of people || []) {
      const uid = p.id as string;
      if (done.has(uid)) continue;
      if (busy.has(uid)) { totals.skippedActive++; continue; }
      const subs = subsBy.get(uid) || [];
      if (!subs.length) { totals.skippedNoPush++; continue; }
      const lang: Lang = pickLang(p.lang);
      const m = MSG[d][lang];
      const tag = `return-d${d}`;

      try { await supabase.from("notifications").insert({ user_id: uid, title: m.t, body: m.b, tag, source: "cron" }); } catch (_e) { /* inbox is best-effort */ }

      let delivered = false;
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: m.t, body: m.b, url: "./", page: "pathway", tag }),
          );
          totals.sent++; delivered = true;
        } catch (e) {
          const code = e && typeof e === "object" && "statusCode" in e ? (e as { statusCode: number }).statusCode : 0;
          if (code === 404 || code === 410) { await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint); totals.pruned++; }
          else totals.failed++;
        }
      }
      // log only a delivered nudge: a person whose subscriptions all failed is tried again tomorrow's run only if still inside the window
      if (delivered) await supabase.from("return_reminders_log").upsert({ user_id: uid, day: d }, { onConflict: "user_id,day" });
    }
  }
  return json(totals);
});
