// Weekly Daily-Mentor recap push: once a week (Monday, see the pg_cron
// migration) nudges every currently-active Max learner that this week's
// report is ready, deep-linking straight into Daily Mentor (CoachPage) —
// where the real, always-fresh stats already render client-side from
// computeCoachStats(). This function deliberately does NOT recompute or
// duplicate that logic: the push body only cites the one number simple and
// unambiguous enough to pull straight off the profiles row (real streak),
// everything else the learner sees on tap is the single source of truth.
//
// Off by default: gated on app_settings.weekly_report.enabled, so deploying
// this function and scheduling the cron job is inert on its own — nothing
// sends until an admin flips the switch (AdminWeeklyReport in App.tsx).
//
// Called ONLY by a pg_cron job — verify_jwt:false + x-cron-secret, same
// convention as send-streak-reminders.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const MSG: Record<string, { t: string; b: (streak: number) => string }> = {
  th: { t: "รายงานประจำสัปดาห์พร้อมแล้ว 📊", b: (streak) => `สตรีค ${streak} วัน — ครู TiGA สรุปจุดที่ควรฝึกต่อให้แล้ว แตะเพื่อดูเลย` },
  en: { t: "Your weekly report is ready 📊", b: (streak) => `${streak}-day streak — I've picked out exactly what to focus on next. Tap to see it` },
  zh: { t: "本周报告已生成 📊", b: (streak) => `连续${streak}天——老师已经帮你找出接下来该练的重点，点击查看` },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "weekly_report").maybeSingle();
  if (!setting || !setting.value || !(setting.value as { enabled?: boolean }).enabled) {
    return new Response(JSON.stringify({ skipped: "disabled" }), { headers: { "Content-Type": "application/json" } });
  }

  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured yet" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  webpush.setVapidDetails("mailto:admin@tigaalpha.github.io", VAPID_PUBLIC, VAPID_PRIVATE);

  // "Active Max" mirrors the client's effectivePlan() (payment.tsx) exactly:
  // plan in (max, maxfamily) with plan_until still in the future, OR an admin
  // account. Two plain queries merged in JS rather than one clever filter
  // string — easier to see is correct, and this table is tiny.
  const [{ data: maxRows, error: e1 }, { data: adminRows, error: e2 }] = await Promise.all([
    supabase.from("profiles").select("id, streak, lang, plan_until").eq("banned", false).in("plan", ["max", "maxfamily"]),
    supabase.from("profiles").select("id, streak, lang").eq("banned", false).eq("is_admin", true),
  ]);
  if (e1 || e2) return new Response(JSON.stringify({ error: (e1 || e2)!.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  const nowMs = Date.now();
  const byId = new Map<string, { id: string; streak: number; lang: string | null }>();
  for (const u of maxRows || []) {
    if (u.plan_until && new Date(u.plan_until).getTime() > nowMs) byId.set(u.id, u);
  }
  for (const u of adminRows || []) byId.set(u.id, u); // admins always qualify, regardless of plan_until
  const users = [...byId.values()];

  let sent = 0, pruned = 0, failed = 0, notified = 0;
  for (const u of users) {
    const lang = u.lang === "en" || u.lang === "zh" ? u.lang : "th";
    const m = MSG[lang];
    const title = m.t, body = m.b(u.streak || 0);

    try {
      const { error: nerr } = await supabase.from("notifications").insert({ user_id: u.id, title, body, tag: "weekly-report", source: "cron" });
      if (!nerr) notified++;
    } catch (_e) { /* best-effort — an in-app inbox miss shouldn't block the push below */ }

    const { data: subs } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", u.id);
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url: "./#daily-mentor", page: "coach", tag: "weekly-report" })
        );
        sent++;
      } catch (e) {
        const code = e && typeof e === "object" && "statusCode" in e ? (e as { statusCode: number }).statusCode : 0;
        if (code === 404 || code === 410) { await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint); pruned++; }
        else failed++;
      }
    }
  }

  return new Response(JSON.stringify({ users: users.length, notified, sent, pruned, failed }), { headers: { "Content-Type": "application/json" } });
});
