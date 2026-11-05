import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Images are compressed on the device first; this is a safety margin.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
