import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // lib/dsp/create-worker.ts uses Vite's `?worker` import, which Next cannot resolve.
    resolveAlias: {
      "@/lib/dsp/create-worker": "./lib/dsp/create-worker.next.ts",
    },
  },
};

export default nextConfig;
