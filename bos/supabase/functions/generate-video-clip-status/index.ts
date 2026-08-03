import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

// Google's long-running-operation response shape for video generation has
// shifted across Veo API revisions, so this checks a couple of known
// locations for the finished video instead of assuming one fixed path.
interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string; bytesBase64Encoded?: string } }>;
    };
    generatedVideos?: Array<{ video?: { uri?: string; bytesBase64Encoded?: string } }>;
  };
}

function extractVideo(op: VeoOperation): { uri?: string; bytesBase64Encoded?: string } | null {
  const fromSamples = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
  if (fromSamples) return fromSamples;
  const fromLegacy = op.response?.generatedVideos?.[0]?.video;
  if (fromLegacy) return fromLegacy;
  return null;
}

// btoa() on a huge binary string built via String.fromCharCode(...bytes) blows
// the call stack — encode in fixed-size chunks instead.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const { videoClipId } = await req.json();
    if (!videoClipId || typeof videoClipId !== "string") return jsonResponse({ error: "videoClipId is required" }, 400);

    const { data: clip, error: clipErr } = await admin.from("video_clips").select("*").eq("id", videoClipId).maybeSingle();
    if (clipErr) throw clipErr;
    if (!clip) return jsonResponse({ error: "Video clip not found" }, 404);

    if (clip.status !== "processing") {
      return jsonResponse({ videoClip: clip });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 400);

    const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${clip.operation_name}?key=${apiKey}`);
    if (!opRes.ok) {
      const detail = await opRes.text();
      throw new Error(`Failed to check Veo operation (${opRes.status}): ${detail.slice(0, 400)}`);
    }
    const operation = (await opRes.json()) as VeoOperation;

    if (!operation.done) {
      return jsonResponse({ videoClip: clip });
    }

    if (operation.error) {
      const { data: updated, error: updateErr } = await admin
        .from("video_clips")
        .update({ status: "error", error_message: operation.error.message ?? "Veo generation failed" })
        .eq("id", clip.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return jsonResponse({ videoClip: updated });
    }

    const video = extractVideo(operation);
    if (!video) {
      const { data: updated, error: updateErr } = await admin
        .from("video_clips")
        .update({ status: "error", error_message: "Veo finished but returned no video" })
        .eq("id", clip.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return jsonResponse({ videoClip: updated });
    }

    let videoBase64 = video.bytesBase64Encoded ?? null;
    if (!videoBase64 && video.uri) {
      const downloadUrl = video.uri.includes("?") ? `${video.uri}&key=${apiKey}` : `${video.uri}?key=${apiKey}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error(`Failed to download video (${downloadRes.status})`);
      const bytes = new Uint8Array(await downloadRes.arrayBuffer());
      videoBase64 = bytesToBase64(bytes);
    }

    if (!videoBase64) {
      const { data: updated, error: updateErr } = await admin
        .from("video_clips")
        .update({ status: "error", error_message: "Veo returned no downloadable video data" })
        .eq("id", clip.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return jsonResponse({ videoClip: updated });
    }

    const { data: updated, error: updateErr } = await admin
      .from("video_clips")
      .update({ status: "done", mime_type: "video/mp4", video_base64: videoBase64 })
      .eq("id", clip.id)
      .select("*")
      .single();
    if (updateErr) throw updateErr;

    return jsonResponse({ videoClip: updated });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
