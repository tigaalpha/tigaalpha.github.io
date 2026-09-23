import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff, requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { findDuplicateCandidates, CUSTOMER_ID_TABLES } from "../_shared/merge-customers.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

/**
 * Duplicate-customer cleanup (owner/admin only).
 * GET  → list likely-duplicate pairs (phone or normalized-name match).
 * POST → merge: re-point every customer_id row from the duplicate to the
 *        kept customer, then delete the duplicate. Oldest row survives.
 */
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireStaff(admin, req);
    await requireOwnerOrAdmin(admin, userId);

    const method = req.method.toUpperCase();

    if (method === "GET") {
      const { data: customers } = await admin.from("customers").select("id, name, phone, created_at").order("created_at", { ascending: true });
      const pairs = findDuplicateCandidates(customers ?? []);
      return jsonResponse({ pairs });
    }

    if (method === "POST") {
      const { keepId, duplicateId } = await req.json();
      if (!keepId || !duplicateId || keepId === duplicateId || typeof keepId !== "string" || typeof duplicateId !== "string") {
        return jsonResponse({ error: "keepId และ duplicateId ต้องเป็น id ที่ต่างกัน" }, 400);
      }

      const { data: keepRow } = await admin.from("customers").select("id, name").eq("id", keepId).maybeSingle();
      const { data: dupRow } = await admin.from("customers").select("id, name").eq("id", duplicateId).maybeSingle();
      if (!keepRow || !dupRow) return jsonResponse({ error: "ไม่พบนักเรียนที่เลือก" }, 404);

      // Re-point every FK row first (the duplicate is deleted after, so its
      // ON DELETE SET NULL columns would otherwise silently lose their link).
      const moved: string[] = [];
      const skipped: string[] = [];
      for (const table of CUSTOMER_ID_TABLES) {
        const { error } = await admin
          .from(table as "bookings")
          .update({ customer_id: keepId })
          .eq("customer_id", duplicateId);
        if (error) skipped.push(table);
        else moved.push(table);
      }
      for (const column of ["referrer_customer_id", "referred_customer_id"]) {
        const { error } = await admin
          .from("referrals" as "bookings")
          .update({ [column]: keepId } as never)
          .eq(column, duplicateId);
        if (!error) moved.push(`referrals.${column}`);
        else skipped.push(`referrals.${column}`);
      }

      // Merge anything the duplicate owned that the kept row lacks.
      const { data: dupProfile } = await admin.from("customers").select("phone, line_user_id, notes, learning_goal, lead_source").eq("id", duplicateId).maybeSingle();
      if (dupProfile) {
        const { data: keepProfile } = await admin.from("customers").select("phone, line_user_id, notes, learning_goal, lead_source").eq("id", keepId).maybeSingle();
        const merged: Record<string, unknown> = {};
        if (!keepProfile?.phone && dupProfile.phone) merged.phone = dupProfile.phone;
        if (!keepProfile?.line_user_id && dupProfile.line_user_id) merged.line_user_id = dupProfile.line_user_id;
        if (!keepProfile?.learning_goal && dupProfile.learning_goal) merged.learning_goal = dupProfile.learning_goal;
        if (!keepProfile?.lead_source && dupProfile.lead_source) merged.lead_source = dupProfile.lead_source;
        if (!keepProfile?.notes && dupProfile.notes) merged.notes = dupProfile.notes;
        if (Object.keys(merged).length > 0) {
          await admin.from("customers").update(merged).eq("id", keepId);
        }
      }

      const { error: deleteError } = await admin.from("customers").delete().eq("id", duplicateId);
      if (deleteError) throw deleteError;

      await admin.from("notifications").insert({
        type: "system_alert",
        title: "รวมนักเรียนซ้ำแล้ว",
        body: `รวม "${dupRow.name}" เข้ากับ "${keepRow.name}" (ย้าย ${moved.length} กลุ่มข้อมูล${skipped.length > 0 ? `, ข้าม ${skipped.join(", ")}` : ""})`,
      });

      return jsonResponse({ ok: true, moved: moved.length, skipped });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    await logSystemEvent(admin, "merge-customers", "error", error instanceof Error ? error.message : String(error));
    return await handleUnexpectedError(admin, "merge-customers", error);
  }
});
