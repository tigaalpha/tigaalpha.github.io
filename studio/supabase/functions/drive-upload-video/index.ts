import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { getOrCreateDriveFolder, uploadBytesToDrive, base64ToBytes } from "../_shared/drive.ts";

// Saves a combined motion video (stitched client-side from Veo/Seedance
// clips — see ai-motion-video-card.tsx) into a dedicated Drive folder,
// using the same Google account/refresh token as drive-upload-image. The
// combined video is never persisted server-side (only assembled in the
// browser), so this takes the video bytes directly rather than looking up
// a database row.
const FOLDER_NAME = "Tiga AI BOS - Generated Videos";
const FOLDER_CACHE_KEY = "google_drive_video_folder_id";
const MAX_VIDEO_BASE64_LENGTH = 60_000_000; // ~45MB decoded, generous for a short stitched clip

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

    const accessToken = await getGoogleAccessToken();
    const folderId = await getOrCreateDriveFolder(admin, accessToken, FOLDER_NAME, FOLDER_CACHE_KEY);

    const extension = resolvedMimeType.includes("mp4") ? "mp4" : "webm";
    const { fileId, webViewUrl } = await uploadBytesToDrive(accessToken, {
      name: `tiga-motion-video-${Date.now()}.${extension}`,
      mimeType: resolvedMimeType,
      bytes: base64ToBytes(videoBase64),
      folderId,
    });

    return jsonResponse({ driveFileId: fileId, driveViewUrl: webViewUrl });
  } catch (error) {
    return await handleUnexpectedError(admin, "drive-upload-video", error);
  }
});
