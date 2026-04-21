import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  transpilePackages: ["@agentshield/core", "agentshield", "@agentshield/langchain"],
};

export default nextConfig;
