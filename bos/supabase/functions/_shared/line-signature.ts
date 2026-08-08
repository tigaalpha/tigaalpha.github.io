// Pure LINE webhook signature logic -- HMAC-SHA256 + constant-time compare.
// No Deno-specific API (crypto.subtle is standard Web Crypto, available in
// Deno, Node, and browsers alike) -- split out of line.ts (which needs
// Deno.env for the actual channel secret) purely so
// lib/line-signature.test.ts can import it straight into vitest and get
// real coverage on the code that guards every inbound LINE webhook.

export async function computeLineSignature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

// A naive === lets response-timing leak how many leading bytes matched,
// which over enough requests can help an attacker forge a valid signature.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
