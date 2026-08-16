import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { push as linePush } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// AI receptionist webhook (Feature #1 — e.g. Bland AI). The voice agent
// handles the call (answers, qualifies, books); this webhook receives the
// outcome so it lands in the CRM: customer upserted by phone, call logged,
// a conversation created (channel "phone") with the summary as the opening
// message, and the owner notified on LINE. verify_jwt=false; auth is the
// x-voice-secret header matching integration_settings `voice_agent_secret`.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "voice_agent_secret").maybeSingle();
    if (!secretRow?.value || req.headers.get("x-voice-secret") !== secretRow.value) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      call_id?: string;
      phone?: string;
      status?: string;
      summary?: string;
      transcript_url?: string;
      direction?: string;
    };
    const phone = (body.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!body.call_id || !phone) return jsonResponse({ error: "call_id and phone are required" }, 400);

    // Link to an existing customer by phone, else create a lead.
    const { data: existing } = await admin.from("customers").select("id, name, line_user_id").eq("phone", phone).maybeSingle();
    let customerId: string | null = existing?.id ?? null;
    if (!customerId) {
      const { data: created, error } = await admin
        .from("customers")
        .insert({ name: `โทรเข้า ${phone}`, phone, sales_status: "new_lead", lead_score: 50 })
        .select("id")
        .single();
      if (error) throw error;
      customerId = created.id;
    }

    await admin.from("voice_call_logs").insert({
      call_id: body.call_id,
      direction: body.direction === "outbound" ? "outbound" : "inbound",
      phone,
      customer_id: customerId,
      status: body.status ?? "unknown",
      summary: body.summary ?? null,
      transcript_url: body.transcript_url ?? null,
    });

    const summary = body.summary?.trim();
    if (summary) {
      const { data: conv } = await admin.from("conversations").insert({ channel: "phone", customer_id: customerId }).select("id").single();
      await admin.from("messages").insert({ conversation_id: conv.id, sender: "customer", content: summary });
    }

    // Owner gets a one-line heads-up so nothing slips through.
    const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerRow?.value) {
      const label = existing?.name && existing.name !== `โทรเข้า ${phone}` ? existing.name : `โทร ${phone}`;
      const statusLabel = body.status === "booked" ? "นัดหมายสำเร็จ" : body.status === "callback" ? "ขอให้โทรกลับ" : body.status ?? "โทรเข้า";
      await linePush(ownerRow.value as string, `📞 สายจาก ${label} (${statusLabel})${summary ? `\n${summary.slice(0, 300)}` : ""}`).catch(() => {});
    }

    await logSystemEvent(admin, "voice-agent-webhook", "info", `call ${body.call_id} from ${phone} (${body.status ?? "unknown"})`);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "voice-agent-webhook", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
