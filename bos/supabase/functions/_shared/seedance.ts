import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";

// fal.ai's queue API is the same shape across models — submit, poll a
// status_url, then fetch the result from a response_url once COMPLETED.
// Model slugs confirmed against fal.ai's own docs/GitHub examples
// (bytedance/seedance-2.0/*) — "Seedance 2.5" isn't a live fal.ai model
// yet (only announced), so this offers the confirmed 2.0 standard/fast
// tiers instead of a guessed, nonexistent slug.
export type SeedanceVariant = "seedance-2" | "seedance-2-fast";

const DURATIONS = [4, 8];

function falModelId(variant: SeedanceVariant): string {
  const envKey = variant === "seedance-2" ? "FAL_SEEDANCE_2_MODEL" : "FAL_SEEDANCE_2_FAST_MODEL";
  const fallback = variant === "seedance-2" ? "bytedance/seedance-2.0/image-to-video" : "bytedance/seedance-2.0/fast/image-to-video";
  return Deno.env.get(envKey) ?? fallback;
}

export async function startSeedanceClip(
  admin: SupabaseClient,
  falApiKey: string,
  userId: string,
  image: SourceImage,
  variant: SeedanceVariant
) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  const modelId = falModelId(variant);

  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:${image.mime_type};base64,${image.image_base64}`,
      prompt: image.prompt,
      resolution: "720p",
      duration: String(durationSeconds),
      aspect_ratio: "9:16",
      generate_audio: false,
    }),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text();
    throw new Error(`Seedance request failed (${submitRes.status}): ${detail.slice(0, 400)}`);
  }

  const submitted = (await submitRes.json()) as { request_id?: string; status_url?: string; response_url?: string };
  if (!submitted.status_url || !submitted.response_url) {
    throw new Error("fal.ai did not return the expected queue fields (status_url/response_url)");
  }

  const operationName = JSON.stringify({ statusUrl: submitted.status_url, responseUrl: submitted.response_url });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: variant,
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

export type SeedanceCheckResult = { done: false } | { done: true; videoUrl: string } | { done: true; error: string };

export async function checkSeedanceClip(falApiKey: string, operationName: string): Promise<SeedanceCheckResult> {
  const { statusUrl, responseUrl } = JSON.parse(operationName) as { statusUrl: string; responseUrl: string };

  const statusRes = await fetch(statusUrl, { headers: { Authorization: `Key ${falApiKey}` } });
  if (!statusRes.ok) {
    const detail = await statusRes.text();
    throw new Error(`Failed to check Seedance status (${statusRes.status}): ${detail.slice(0, 400)}`);
  }
  const statusData = (await statusRes.json()) as { status?: string; error?: string };

  if (statusData.status !== "COMPLETED") {
    if (statusData.status === "ERROR" || statusData.error) {
      return { done: true, error: statusData.error ?? "Seedance generation failed" };
    }
    return { done: false };
  }

  const resultRes = await fetch(responseUrl, { headers: { Authorization: `Key ${falApiKey}` } });
  if (!resultRes.ok) {
    const detail = await resultRes.text();
    throw new Error(`Failed to fetch Seedance result (${resultRes.status}): ${detail.slice(0, 400)}`);
  }
  const result = (await resultRes.json()) as { video?: { url?: string }; error?: string };
  if (result.error) return { done: true, error: result.error };
  if (!result.video?.url) return { done: true, error: "Seedance finished but returned no video URL" };

  return { done: true, videoUrl: result.video.url };
}
