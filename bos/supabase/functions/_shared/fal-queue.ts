// Generic fal.ai queue polling — shared by every fal-hosted video model
// (Seedance, Luma Ray-2). Submission bodies differ per model, but the
// queue lifecycle (submit -> status_url -> response_url) is identical.
export type FalQueueCheckResult = { done: false } | { done: true; videoUrl: string } | { done: true; error: string };

export async function submitFalQueue(
  falApiKey: string,
  modelId: string,
  input: Record<string, unknown>
): Promise<{ statusUrl: string; responseUrl: string }> {
  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!submitRes.ok) {
    const detail = await submitRes.text();
    throw new Error(`fal.ai request failed (${submitRes.status}): ${detail.slice(0, 400)}`);
  }

  const submitted = (await submitRes.json()) as { status_url?: string; response_url?: string };
  if (!submitted.status_url || !submitted.response_url) {
    throw new Error("fal.ai did not return the expected queue fields (status_url/response_url)");
  }

  return { statusUrl: submitted.status_url, responseUrl: submitted.response_url };
}

export async function checkFalQueueClip(falApiKey: string, operationName: string): Promise<FalQueueCheckResult> {
  const { statusUrl, responseUrl } = JSON.parse(operationName) as { statusUrl: string; responseUrl: string };

  const statusRes = await fetch(statusUrl, { headers: { Authorization: `Key ${falApiKey}` } });
  if (!statusRes.ok) {
    const detail = await statusRes.text();
    throw new Error(`Failed to check fal.ai status (${statusRes.status}): ${detail.slice(0, 400)}`);
  }
  const statusData = (await statusRes.json()) as { status?: string; error?: string };

  if (statusData.status !== "COMPLETED") {
    if (statusData.status === "ERROR" || statusData.error) {
      return { done: true, error: statusData.error ?? "fal.ai generation failed" };
    }
    return { done: false };
  }

  const resultRes = await fetch(responseUrl, { headers: { Authorization: `Key ${falApiKey}` } });
  if (!resultRes.ok) {
    const detail = await resultRes.text();
    throw new Error(`Failed to fetch fal.ai result (${resultRes.status}): ${detail.slice(0, 400)}`);
  }
  const result = (await resultRes.json()) as { video?: { url?: string }; error?: string };
  if (result.error) return { done: true, error: result.error };
  if (!result.video?.url) return { done: true, error: "fal.ai finished but returned no video URL" };

  return { done: true, videoUrl: result.video.url };
}
