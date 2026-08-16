import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/constants";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: BASE_PATH,
  images: {
    unoptimized: true,
  },
  // The build sandbox has a 2 GB memory cap; with 48 cores Next would spawn
  // dozens of parallel prerender workers and get OOM-killed during
  // "Collecting page data". Capping the build CPUs keeps the build inside it.
  experimental: {
    cpus: 2,
  },
  // Public Supabase config for the BOS project — the anon key is designed to
  // be shipped to the browser (RLS is the real security boundary). Baked at
  // build time so static exports build anywhere without a local .env file.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://tzgktczefypwhhmyxlmj.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6Z2t0Y3plZnlwd2hobXl4bG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODA3NzEsImV4cCI6MjA5ODY1Njc3MX0.Kaqrsgxmeg-MunXDTgMDU-sv9sQ_rcVNUJnGkn_ZO0Q",
  },
};

export default nextConfig;
