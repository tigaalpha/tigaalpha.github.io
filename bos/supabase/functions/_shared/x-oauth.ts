// X (Twitter) OAuth 1.0a signing helpers — implemented by hand (RFC 5849
// signature base string + RFC 3986 percent-encoding, HMAC-SHA1 via WebCrypto)
// because there's no SDK here; same fetch-based approach as the rest of
// _shared/. Used by x-oauth-start / x-oauth-callback and by social-publish's
// publishToX.
//
// Consumer key/secret: consumer key is entered in Settings > Integrations
// (stored in integration_settings `x_client_key`, same pattern as
// meta_app_id), consumer secret lives as the X_API_SECRET Edge Function
// secret. User tokens come from the OAuth dance and are stored per-user in
// social_accounts (access_token = oauth_token, refresh_token = oauth_token_secret).

const enc = new TextEncoder();

/** RFC 3986 percent-encoding — encodeURIComponent leaves !'()* unencoded, which OAuth requires encoding. */
export function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const keyBuf = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", keyBuf, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

type Param = [string, string];

function nonce(): string {
  return crypto.randomUUID().replace(/-/g, "") + Math.floor(Math.random() * 1e6).toString(36);
}

/** Build the signature base string (RFC 5849 3.4.1): METHOD & enc(baseUrl) & enc(sorted params). */
function signatureBaseString(method: string, baseUrl: string, params: Param[]): string {
  const sorted = [...params].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  const normalized = sorted.map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`).join("&");
  return `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(normalized)}`;
}

/**
 * Build the Authorization: OAuth ... header for one request. `extraParams`
 * are request-specific signed parameters (e.g. oauth_callback on the
 * request_token call, oauth_verifier on the access_token call). For
 * x-www-form-urlencoded bodies the same params must ALSO be sent in the
 * body; JSON/multipart bodies are not part of the signature.
 */
export async function buildOAuthHeader(creds: OAuthCredentials, method: string, baseUrl: string, extraParams: Param[] = []): Promise<string> {
  const oauthParams: Param[] = [
    ["oauth_consumer_key", creds.consumerKey],
    ["oauth_nonce", nonce()],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", String(Math.floor(Date.now() / 1000))],
    ["oauth_version", "1.0"],
  ];
  if (creds.token) oauthParams.push(["oauth_token", creds.token]);

  const allParams = [...oauthParams, ...extraParams];
  const signingKey = `${creds.consumerSecret}&${creds.tokenSecret ?? ""}`;
  const signature = await hmacSha1Base64(signingKey, signatureBaseString(method, baseUrl, allParams));

  const headerParams = [...oauthParams, ["oauth_signature", signature] as Param];
  return `OAuth ${headerParams.map(([k, v]) => `${k}="${percentEncode(v)}"`).join(", ")}`;
}

/** Parse a form-encoded X OAuth response (request_token / access_token). */
export function parseOAuthForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    if (key) out[key] = value;
  }
  return out;
}
