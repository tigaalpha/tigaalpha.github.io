import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

// ต้นตอ "แอปโชว์ 0 / การเชื่อมต่อไม่ขึ้น": บัญชีที่ login ไม่มี row ใน
// profiles → is_staff() เป็น false → RLS กรองทุก query เป็นค่าว่างเงียบๆ
// และ edge function ทุกตัวที่ requireStaff() ตอบ 403 (ดู SETUP.md E4 —
// เดิมต้องสร้าง row ด้วยมือ) ฟังก์ชันนี้ทำให้ระบบ "ตั้งตัวเอง" หลัง login
// ครั้งแรก: คนแรกของระบบกลายเป็น owner, คนถัดไปเป็น staff
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const admin = createAdminClient();

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const { data: existing } = await admin.from("profiles").select("id, role, full_name").eq("id", userId).maybeSingle();
    if (existing) return jsonResponse({ created: false, role: existing.role, full_name: existing.full_name });

    // First-ever profile = owner (single-owner org); later signups = staff.
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    const role = count === 0 ? "owner" : "staff";

    const metaName = userData.user.user_metadata?.full_name ?? userData.user.user_metadata?.name;
    const fullName =
      typeof metaName === "string" && metaName.trim()
        ? metaName.trim()
        : (userData.user.email?.split("@")[0]?.trim() || "Owner");

    const { data: row, error } = await admin
      .from("profiles")
      .insert({ id: userId, full_name: fullName, role })
      .select("id, role, full_name")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ created: true, role: row.role, full_name: row.full_name });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, 500);
  }
});
