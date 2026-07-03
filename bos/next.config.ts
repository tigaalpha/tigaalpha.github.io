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
};

export default nextConfig;
