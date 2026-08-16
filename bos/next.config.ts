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
};

export default nextConfig;
