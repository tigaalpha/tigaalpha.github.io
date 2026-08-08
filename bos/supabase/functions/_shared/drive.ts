import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Shared Google Drive helpers -- folder-per-purpose creation (cached in
// integration_settings) + multipart upload + making a file link-readable.
// Used by drive-upload-video, drive-upload-image, and receipt-drive-sync,
// which previously each hand-rolled their own copy of this exact logic
// (including the access-token refresh that _shared/google-auth.ts already
// does, with caching that the old copies didn't have).

export async function getOrCreateDriveFolder(
  admin: SupabaseClient,
  accessToken: string,
  folderName: string,
  cacheKey: string
): Promise<string> {
  const cached = await admin.from("integration_settings").select("value").eq("key", cacheKey).maybeSingle();
  if (cached.data?.value) return cached.data.value;

  const searchParams = new URLSearchParams({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files && searchData.files.length > 0) {
      const id = searchData.files[0].id;
      await admin.from("integration_settings").upsert({ key: cacheKey, value: id }, { onConflict: "key" });
      return id;
    }
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text();
    throw new Error(`Failed to create Drive folder (${createRes.status}): ${detail.slice(0, 400)}`);
  }
  const created = (await createRes.json()) as { id: string };
  await admin.from("integration_settings").upsert({ key: cacheKey, value: created.id }, { onConflict: "key" });
  return created.id;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface DriveUploadResult {
  fileId: string;
  webViewUrl: string;
}

export async function uploadBytesToDrive(
  accessToken: string,
  params: { name: string; mimeType: string; bytes: Uint8Array; folderId: string }
): Promise<DriveUploadResult> {
  const boundary = "tiga_" + crypto.randomUUID().replace(/-/g, "");
  const metadata = { name: params.name, parents: [params.folderId] };

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(preamble.length + params.bytes.length + closing.length);
  body.set(preamble, 0);
  body.set(params.bytes, preamble.length);
  body.set(closing, preamble.length + params.bytes.length);

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${text.slice(0, 300)}`);
  }
  const uploaded = (await uploadRes.json()) as { id: string; webViewLink?: string };
  return { fileId: uploaded.id, webViewUrl: uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view` };
}

// drive.file scope covers permissions on files this app created, so this
// works without any extra OAuth scope -- makes a receipt viewable by
// anyone with the link (needed so a LINE message can link straight to it;
// the customer has no Google login of their own to grant access to).
export async function makeDriveFileReadable(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to make Drive file readable (${res.status}): ${text.slice(0, 300)}`);
  }
}
