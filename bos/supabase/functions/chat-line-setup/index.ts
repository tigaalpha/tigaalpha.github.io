import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { CHAT_FEATURE_KEYS, CHAT_FEATURE_LABELS, isFeatureEnabled } from "../_shared/chat-features.ts";

// งานแชท #2 — LINE Rich Menu: สร้าง/อัปเดตเมนูปุ่มกดใต้แชท LINE
// (จองคอร์ส / ดูตาราง / ราคา / คุยกับคน) — กดแล้วส่ง postback มาที่
// line-webhook ซึ่งจะตอบกลับด้วยข้อมูลที่เกี่ยวข้อง (ดู webhook handler)
// เรียกได้ทั้งจาก cron รายสัปดาห์ (x-cron-secret) และปุ่มใน Settings (JWT)
const MENU_NAME = "Tiga Main";
const RICH_MENU_IMAGE_URL = "https://tigaalpha.github.io/studio/rich-menu.png";
const AREAS = [
  { x: 0, y: 0, width: 625, height: 843, data: "MENU_BOOK", label: "จองคอร์ส" },
  { x: 625, y: 0, width: 625, height: 843, data: "MENU_SCHEDULE", label: "ดูตาราง" },
  { x: 1250, y: 0, width: 625, height: 843, data: "MENU_PRICE", label: "ราคา" },
  { x: 1875, y: 0, width: 625, height: 843, data: "MENU_HUMAN", label: "คุยกับคน" },
];

async function lineApi(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`https://api.line.me/v2/bot${path}`, { ...init, headers });
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    // ยอมรับทั้ง cron secret และ staff JWT
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      await requireStaff(admin, req);
    } else if (!(await checkCronSecret(admin, req))) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: flagRows } = await admin.from("integration_settings").select("key, value");
    const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;
    if (!isFeatureEnabled(flags, "richMenu")) {
      return jsonResponse({ skipped: "feature disabled" });
    }
    if (!Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")) {
      return jsonResponse({ error: "LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้ง — เชื่อม LINE ก่อนใน Settings" }, 400);
    }

    // 1) ลบเมนูเก่าชื่อเดียวกัน (ถ้าเป็น default ต้อง unset ก่อน)
    const listRes = await lineApi("/richmenu/list");
    if (!listRes.ok) throw new Error(`LINE richmenu list failed: ${await listRes.text()}`);
    const list = (await listRes.json()) as { richmenus?: { richMenuId: string; name: string }[] };
    for (const menu of list.richmenus ?? []) {
      if (menu.name !== MENU_NAME) continue;
      const unset = await lineApi(`/richmenu/${menu.richMenuId}/default`, { method: "DELETE" });
      const del = await lineApi(`/richmenu/${menu.richMenuId}`, { method: "DELETE" });
      await logSystemEvent(admin, "chat-line-setup", "info", `cleanup old menu ${menu.richMenuId}: unset=${unset.status} delete=${del.status}`);
    }

    // 2) สร้างเมนูใหม่ — selected:true = ตั้งเป็น default ตั้งแต่ตอนสร้าง
    //    (เส้นทางที่ LINE แนะนำ; การ POST /richmenu/{id}/default แยกทีหลัง
    //    มักตอบ "Not found" หลังเพิ่งสร้าง+อัปโหลดรูป)
    const createRes = await lineApi("/richmenu", {
      method: "POST",
      body: JSON.stringify({
        size: { width: 2500, height: 843 },
        selected: true,
        name: MENU_NAME,
        chatBarText: "เมนู",
        areas: AREAS.map((a) => ({
          bounds: { x: a.x, y: a.y, width: a.width, height: a.height },
          action: { type: "postback", data: a.data, label: a.label },
        })),
      }),
    });
    if (!createRes.ok) throw new Error(`LINE richmenu create failed: ${await createRes.text()}`);
    const { richMenuId } = (await createRes.json()) as { richMenuId: string };
    await logSystemEvent(admin, "chat-line-setup", "info", `created richmenu ${richMenuId} (selected:true)`);

    // 3) อัปโหลดรูปเมนู (PNG โฮสต์บน GitHub Pages — bos/public/rich-menu.png)
    const imgRes = await fetch(RICH_MENU_IMAGE_URL);
    if (!imgRes.ok) throw new Error(`fetch rich-menu.png failed: ${imgRes.status}`);
    const imgBytes = await imgRes.arrayBuffer();
    const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")}`,
        "Content-Type": "image/png",
      },
      body: imgBytes,
    });
    if (!uploadRes.ok) throw new Error(`LINE richmenu upload failed: ${await uploadRes.text()}`);
    await logSystemEvent(admin, "chat-line-setup", "info", `uploaded image to ${richMenuId}: ${uploadRes.status}`);

    // 4) ยืนยันว่าเป็น default แล้ว (สร้างด้วย selected:true — ถ้า LINE
    //    ตอบ "Not found" ชั่วครู่หลัง upload ให้ลองใหม่ไม่กี่ครั้ง)
    let isDefault = false;
    for (let attempt = 1; attempt <= 5 && !isDefault; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const check = await lineApi(`/richmenu/${richMenuId}`, { method: "GET" });
      if (check.ok) {
        const body = (await check.json()) as { richMenuId?: string; selected?: boolean };
        isDefault = body.richMenuId === richMenuId && body.selected === true;
        if (!isDefault) {
          const setRes = await lineApi(`/richmenu/${richMenuId}/default`, { method: "POST" });
          isDefault = setRes.ok;
        }
      }
    }
    if (!isDefault) throw new Error("LINE richmenu could not be set as default");

    await logSystemEvent(admin, "chat-line-setup", "info", `Rich Menu "${MENU_NAME}" ตั้งเป็นค่าเริ่มต้นแล้ว (${richMenuId})`);
    return jsonResponse({ ok: true, richMenuId, areas: AREAS.map((a) => a.label) });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-line-setup", error);
  }
});
