import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Saves a combined motion video (stitched client-side from Veo/Seedance
// clips — see ai-motion-video-card.tsx) into a dedicated Drive folder,
// using the same Google account/refresh token as drive-upload-image. The
// combined video is never persisted server-side (only assembled in the
// browser), so this takes the video bytes directly rather than looking up
// a database row.
const FOLDER_NAME = "Tiga AI BOS - Generated Videos";
const MAX_VIDEO_BASE64_LENGTH = 60_000_000; // ~45MB decoded, generous for a short stitched clip

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access token returned");
  return data.access_token;
}

async function getOrCreateFolder(accessToken: string, admin: SupabaseClient): Promise<string> {
  const cached = await admin.from("integration_settings").select("value").eq("key", "google_drive_video_folder_id").maybeSingle();
  if (cached.data?.value) return cached.data.value;

  const searchParams = new URLSearchParams({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files && searchData.files.length > 0) {
      const id = searchData.files[0].id;
      await admin.from("integration_settings").upsert({ key: "google_drive_video_folder_id", value: id }, { onConflict: "key" });
      return id;
    }
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text();
    throw new Error(`Failed to create Drive folder (${createRes.status}): ${detail.slice(0, 400)}`);
  }
  const created = (await createRes.json()) as { id: string };
  await admin.from("integration_settings").upsert({ key: "google_drive_video_folder_id", value: created.id }, { onConflict: "key" });
  return created.id;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const { videoBase64, mimeType } = await req.json();
    if (!videoBase64 || typeof videoBase64 !== "string") return jsonResponse({ error: "videoBase64 is required" }, 400);
    if (videoBase64.length > MAX_VIDEO_BASE64_LENGTH) return jsonResponse({ error: "Video is too large to upload" }, 400);
    // Spliced raw into the multipart body below as a MIME header value --
    // restricted to a strict allow-list so a value containing CRLF can't
    // inject an extra multipart part into the request sent to Google Drive.
    if (mimeType !== undefined && (typeof mimeType !== "string" || !/^video\/(webm|mp4)$/.test(mimeType))) {
      return jsonResponse({ error: 'mimeType must be "video/webm" or "video/mp4"' }, 400);
    }
    const resolvedMimeType = mimeType || "video/webm";

    const { data: tokenRow } = await admin.from("integration_settings").select("value").eq("key", "google_refresh_token").maybeSingle();
    const refreshToken = tokenRow?.value;
    if (!refreshToken) {
      return jsonResponse(
        { error: "ยังไม่ได้เชื่อมต่อ Google — ไปที่ Settings > Integrations แล้วกด Connect Google Calendar ก่อน (จะขอสิทธิ์ Drive มาด้วย)" },
        400
      );
    }

    const { data: clientIdRow } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
    const clientId = clientIdRow?.value;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Google Client ID/Secret not configured" }, 400);
    }

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const folderId = await getOrCreateFolder(accessToken, admin);

    const extension = resolvedMimeType.includes("mp4") ? "mp4" : "webm";
    const boundary = "tiga_" + crypto.randomUUID().replace(/-/g, "");
    const metadata = { name: `tiga-motion-video-${Date.now()}.${extension}`, parents: [folderId] };
    const videoBytes = base64ToBytes(videoBase64);

    const encoder = new TextEncoder();
    const preamble = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${resolvedMimeType}\r\n\r\n`
    );
    const closing = encoder.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(preamble.length + videoBytes.length + closing.length);
    body.set(preamble, 0);
    body.set(videoBytes, preamble.length);
    body.set(closing, preamble.length + videoBytes.length);

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Drive upload failed (${uploadRes.status}): ${text.slice(0, 300)}`);
    }
    const uploaded = (await uploadRes.json()) as { id: string; webViewLink?: string };
    const driveViewUrl = uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`;

    return jsonResponse({ driveFileId: uploaded.id, driveViewUrl });
  } catch (error) {
    return await handleUnexpectedError(admin, "drive-upload-video", error);
  }
});
