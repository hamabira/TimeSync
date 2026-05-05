import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  import("@cloudflare/next-on-pages/next-dev").then(({ setupDevPlatform }) => {
    setupDevPlatform().catch((error) => {
      console.error("Failed to initialize Cloudflare dev platform", error);
    });
  });
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    webpackBuildWorker: false,
  },
  reactCompiler: true,
};

export default nextConfig;
