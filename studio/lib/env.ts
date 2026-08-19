function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Static export ships only public, non-secret configuration to the browser.
 * Anything requiring a secret (Gemini key, Google client secret, LINE
 * tokens) lives in Supabase Edge Function secrets instead — see
 * supabase/functions/*.
 */
export const env = {
  supabase: {
    url: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
};
