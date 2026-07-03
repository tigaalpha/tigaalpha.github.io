function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabase: {
    url: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
  ai: {
    provider: () => process.env.AI_PROVIDER ?? "gemini",
    model: () => process.env.AI_MODEL ?? "gemini-flash-latest",
    apiKey: () => required("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
    embeddingModel: () => process.env.AI_EMBEDDING_MODEL ?? "text-embedding-004",
  },
  google: {
    clientId: () => required("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID),
    clientSecret: () => required("GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET),
    calendarId: () => process.env.GOOGLE_CALENDAR_ID ?? "primary",
    redirectUri: () => required("GOOGLE_REDIRECT_URI", process.env.GOOGLE_REDIRECT_URI),
  },
  line: {
    channelSecret: () => required("LINE_CHANNEL_SECRET", process.env.LINE_CHANNEL_SECRET),
    channelAccessToken: () => required("LINE_CHANNEL_ACCESS_TOKEN", process.env.LINE_CHANNEL_ACCESS_TOKEN),
    officialAccountId: () => process.env.LINE_OA_ID ?? "422gobjh",
  },
};
