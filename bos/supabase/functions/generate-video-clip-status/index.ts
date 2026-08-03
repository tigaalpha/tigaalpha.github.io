import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { checkFalQueueClip } from "../_shared/fal-queue.ts";
import { checkRunwayClip } from "../_shared/runway.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

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

function extractVeoVideo(op: VeoOperation): { uri?: string; bytesBase64Encoded?: string } | null {
  const fromSamples = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
  if (fromSamples) return fromSamples;
  const fromLegacy = op.response?.generatedVideos?.[0]?.video;
  if (fromLegacy) return fromLegacy;
  return null;
}

type CheckResult = { done: false } | { done: true; error: string } | { done: true; videoUrl: string } | { done: true; videoBase64: string };

async function checkVeo(apiKey: string, operationName: string): Promise<CheckResult> {
  const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`);
  if (!opRes.ok) {
    const detail = await opRes.text();
    throw new Error(`Failed to check Veo operation (${opRes.status}): ${detail.slice(0, 400)}`);
  }
  const operation = (await opRes.json()) as VeoOperation;

  if (!operation.done) return { done: false };
  if (operation.error) return { done: true, error: operation.error.message ?? "Veo generation failed" };

  const video = extractVeoVideo(operation);
  if (!video) return { done: true, error: "Veo finished but returned no video" };
  if (video.bytesBase64Encoded) return { done: true, videoBase64: video.bytesBase64Encoded };
  if (video.uri) {
    const videoUrl = video.uri.includes("?") ? `${video.uri}&key=${apiKey}` : `${video.uri}?key=${apiKey}`;
    return { done: true, videoUrl };
  }
  return { done: true, error: "Veo returned no downloadable video data" };
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

  const admin = createAdminClient();
  let clipIdForLogging: string | null = null;

  try {
    await requireStaff(admin, req);

    const { videoClipId } = await req.json();
    if (!videoClipId || typeof videoClipId !== "string") return jsonResponse({ error: "videoClipId is required" }, 400);
    clipIdForLogging = videoClipId;

    const { data: clip, error: clipErr } = await admin.from("video_clips").select("*").eq("id", videoClipId).maybeSingle();
    if (clipErr) throw clipErr;
    if (!clip) return jsonResponse({ error: "Video clip not found" }, 404);

    if (clip.status !== "processing") {
      return jsonResponse({ videoClip: clip });
    }
    if (!clip.operation_name) {
      return jsonResponse({ error: "Video clip has no operation_name to check" }, 500);
    }

    let result: CheckResult;
    if (clip.provider === "veo") {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 400);
      result = await checkVeo(apiKey, clip.operation_name);
    } else if (clip.provider === "runway-gen4-turbo") {
      const apiKey = Deno.env.get("RUNWAY_API_KEY");
      if (!apiKey) {
        return jsonResponse(
          { error: "ยังไม่ได้ตั้งค่า RUNWAY_API_KEY — ไปที่ Supabase Dashboard > Edge Functions > Secrets เพื่อเพิ่มก่อนใช้ Runway" },
          400
        );
      }
      const runwayResult = await checkRunwayClip(apiKey, clip.operation_name);
      result = runwayResult.done
        ? "videoUrl" in runwayResult
          ? { done: true, videoUrl: runwayResult.videoUrl }
          : { done: true, error: runwayResult.error }
        : { done: false };
    } else {
      // seedance-2, seedance-2-fast, luma-ray-2 — all hosted on fal.ai
      const apiKey = Deno.env.get("FAL_API_KEY");
      if (!apiKey) {
        return jsonResponse(
          { error: "ยังไม่ได้ตั้งค่า FAL_API_KEY — ไปที่ Supabase Dashboard > Edge Functions > Secrets เพื่อเพิ่มก่อนใช้ Seedance/Luma" },
          400
        );
      }
      const falResult = await checkFalQueueClip(apiKey, clip.operation_name);
      result = falResult.done
        ? "videoUrl" in falResult
          ? { done: true, videoUrl: falResult.videoUrl }
          : { done: true, error: falResult.error }
        : { done: false };
    }

    if (!result.done) {
      return jsonResponse({ videoClip: clip });
    }

    if ("error" in result) {
      const { data: updated, error: updateErr } = await admin
        .from("video_clips")
        .update({ status: "error", error_message: result.error })
        .eq("id", clip.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return jsonResponse({ videoClip: updated });
    }

    let videoBase64: string;
    if ("videoBase64" in result) {
      videoBase64 = result.videoBase64;
    } else {
      const downloadRes = await fetch(result.videoUrl);
      if (!downloadRes.ok) throw new Error(`Failed to download video (${downloadRes.status})`);
      const bytes = new Uint8Array(await downloadRes.arrayBuffer());
      videoBase64 = bytesToBase64(bytes);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "generate-video-clip-status", "error", `clip=${clipIdForLogging ?? "?"} ${message}`);
    return jsonResponse({ error: message }, 500);
  }
});
