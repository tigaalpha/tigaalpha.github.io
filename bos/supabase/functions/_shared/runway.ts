import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";
import type { VideoOrientation } from "./video-providers.ts";

// Runway's own API (not on fal.ai) — confirmed against docs.dev.runwayml.com:
// POST /v1/image_to_video to submit, GET /v1/tasks/{id} to poll. Requires
// its own RUNWAY_API_KEY (separate signup from Google/fal.ai). Whether
// promptImage accepts an inline data: URI (vs. requiring a real hosted
// URL) isn't confirmed — this is the biggest unknown of this integration.
const BASE_URL = "https://api.dev.runwayml.com/v1";
const API_VERSION = "2024-11-06";
const DURATIONS = [5, 10];

function runwayModel(): string {
  return Deno.env.get("RUNWAY_MODEL") ?? "gen4_turbo";
}

function runwayHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

export async function startRunwayClip(
  admin: SupabaseClient,
  apiKey: string,
  userId: string,
  image: SourceImage,
  orientation: VideoOrientation = "vertical"
) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  // Runway takes exact pixel dimensions rather than a ratio string.
  const ratio = orientation === "horizontal" ? "1280:720" : "720:1280";

  const submitRes = await fetch(`${BASE_URL}/image_to_video`, {
    method: "POST",
    headers: runwayHeaders(apiKey),
    body: JSON.stringify({
      model: runwayModel(),
      promptImage: `data:${image.mime_type};base64,${image.image_base64}`,
      promptText: image.prompt,
      ratio,
      duration: durationSeconds,
    }),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text();
    throw new Error(`Runway request failed (${submitRes.status}): ${detail.slice(0, 400)}`);
  }

  const submitted = (await submitRes.json()) as { id?: string };
  if (!submitted.id) throw new Error("Runway did not return a task id");

  const operationName = JSON.stringify({ taskId: submitted.id });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: "runway-gen4-turbo",
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

export type RunwayCheckResult = { done: false } | { done: true; videoUrl: string } | { done: true; error: string };

export async function checkRunwayClip(apiKey: string, operationName: string): Promise<RunwayCheckResult> {
  const { taskId } = JSON.parse(operationName) as { taskId: string };

  const taskRes = await fetch(`${BASE_URL}/tasks/${taskId}`, { headers: runwayHeaders(apiKey) });
  if (!taskRes.ok) {
    const detail = await taskRes.text();
    throw new Error(`Failed to check Runway task (${taskRes.status}): ${detail.slice(0, 400)}`);
  }
  const task = (await taskRes.json()) as { status?: string; output?: string[]; failure?: string };

  if (task.status === "SUCCEEDED") {
    const videoUrl = task.output?.[0];
    if (!videoUrl) return { done: true, error: "Runway finished but returned no output video" };
    return { done: true, videoUrl };
  }
  if (task.status === "FAILED" || task.status === "CANCELED") {
    return { done: true, error: task.failure ?? `Runway task ${task.status}` };
  }
  return { done: false };
}
