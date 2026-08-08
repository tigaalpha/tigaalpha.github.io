import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { getOrCreateDriveFolder, uploadBytesToDrive, base64ToBytes } from "../_shared/drive.ts";

// Saves a generated image into a dedicated Drive folder using the same
// Google account already connected for Calendar — that OAuth grant now also
// asks for the drive.file scope (files this app creates only, nothing else
// in the user's Drive).
const FOLDER_NAME = "Tiga AI BOS - Generated Images";
const FOLDER_CACHE_KEY = "google_drive_folder_id";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const { imageId } = await req.json();
    if (!imageId || typeof imageId !== "string") return jsonResponse({ error: "imageId is required" }, 400);

    const { data: image, error: imageErr } = await admin
      .from("generated_images")
      .select("id, mime_type, image_base64")
      .eq("id", imageId)
      .maybeSingle();
    if (imageErr) throw imageErr;
    if (!image) return jsonResponse({ error: "Image not found" }, 404);

    const accessToken = await getGoogleAccessToken();
    const folderId = await getOrCreateDriveFolder(admin, accessToken, FOLDER_NAME, FOLDER_CACHE_KEY);

    const { fileId, webViewUrl } = await uploadBytesToDrive(accessToken, {
      name: `tiga-${image.id}.png`,
      mimeType: image.mime_type,
      bytes: base64ToBytes(image.image_base64),
      folderId,
    });

    const { error: updateErr } = await admin.from("generated_images").update({ drive_file_id: fileId, drive_view_url: webViewUrl }).eq("id", image.id);
    if (updateErr) throw updateErr;

    return jsonResponse({ driveFileId: fileId, driveViewUrl: webViewUrl });
  } catch (error) {
    return await handleUnexpectedError(admin, "drive-upload-image", error);
  }
});
