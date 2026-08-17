import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push, checkConnection as checkLineConnection } from "../_shared/line.ts";
import { checkConnection as checkCalendarConnection } from "../_shared/calendar.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const WINDOW_MINUTES = 15;
const ERROR_THRESHOLD = 3; // errors within WINDOW_MINUTES that count as "something's wrong"
const ALERT_COOLDOWN_MINUTES = 60; // don't re-alert every tick while the same spike is ongoing

// LINE/Calendar disconnects checked every tick (15 min) but only logged
// once per hour while the outage continues, same cooldown idea as the
// error-spike alert below, so a sustained outage doesn't spam system_events.
const CONNECTION_LOG_COOLDOWN_MINUTES = 60;

async function checkAndLogConnection(admin: SupabaseClient, source: string, isConnected: boolean, message: string): Promise<void> {
  if (isConnected) return;
  const cooldownStart = new Date(Date.now() - CONNECTION_LOG_COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin.from("system_events").select("id", { count: "exact", head: true }).eq("source", source).eq("severity", "error").gte("created_at", cooldownStart);
  if ((count ?? 0) > 0) return;
  await logSystemEvent(admin, source, "error", message);
}

/**
 * Called on a schedule by pg_cron + pg_net (see migration
 * 0026_system_health_cron). Public (verify_jwt=false) — same
 * x-cron-secret pattern as follow-up-conversations, since pg_net has no
 * Supabase session to attach.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  // Cron-auth fix: every other cron validates the env CRON_SECRET first
  // (see cron-auth.ts), but this function only accepted the DB-stored
  // value — so once the env secret drifted from the DB value, every tick
  // silently 401'd and the dashboard lost its health signal for weeks.
  // Same env-first pattern as the rest of the system now.
  if (!(await checkCronSecret(admin, req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const [lineOk, calendarOk] = await Promise.all([checkLineConnection(), checkCalendarConnection()]);
  await checkAndLogConnection(admin, "line", lineOk, "LINE Messaging API ไม่ตอบสนอง — ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ในหน้า Settings");
  await checkAndLogConnection(admin, "google-calendar", calendarOk, "Google Calendar API ไม่ตอบสนอง — อาจต้องเชื่อมต่อบัญชี Google ใหม่ในหน้า Settings");

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: errorCount, error: countErr } = await admin
    .from("system_events")
    .select("id", { count: "exact", head: true })
    .eq("severity", "error")
    .gte("created_at", windowStart);
  if (countErr) throw countErr;

  if ((errorCount ?? 0) < ERROR_THRESHOLD) {
    // Liveness signal: log an "ok" once per day so the dashboard's system
    // event feed proves this cron is actually running (it was silent for
    // weeks while 401-ing).
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: okToday } = await admin
      .from("system_events")
      .select("id", { count: "exact", head: true })
      .eq("source", "system-health-check")
      .eq("severity", "info")
      .gte("created_at", dayStart.toISOString());
    if ((okToday ?? 0) === 0) {
      await logSystemEvent(admin, "system-health-check", "info", `ระบบปกติ — LINE ${lineOk ? "เชื่อมต่อ" : "มีปัญหา"}, Google Calendar ${calendarOk ? "เชื่อมต่อ" : "มีปัญหา"}, errorCount ${errorCount ?? 0} ใน ${WINDOW_MINUTES} นาที`);
    }
    return jsonResponse({ errorCount: errorCount ?? 0, alerted: false });
  }

  // Avoid spamming the owner every tick while the same spike is still ongoing.
  const cooldownStart = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const { count: recentAlerts } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "system_alert")
    .gte("created_at", cooldownStart);
  if ((recentAlerts ?? 0) > 0) {
    return jsonResponse({ errorCount, alerted: false, reason: "cooldown" });
  }

  const message = `ระบบ AI พบข้อผิดพลาด ${errorCount} ครั้งใน ${WINDOW_MINUTES} นาทีที่ผ่านมา — อาจมีปัญหา (เช่น Gemini quota เต็ม หรือระบบขัดข้อง) กรุณาตรวจสอบหน้า System Health`;

  await admin.from("notifications").insert({ type: "system_alert", title: "ระบบ AI มีข้อผิดพลาดผิดปกติ", body: message });

  const { data: ownerLineIdRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerLineIdRow?.value) {
    try {
      await push(ownerLineIdRow.value, message);
    } catch {
      // best-effort — the in-app notification above is the source of truth
    }
  }

  return jsonResponse({ errorCount, alerted: true });
});
