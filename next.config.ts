import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb', // Allow up to 1GB for file uploads (academy PDFs/videos)
    },
  },
};

export default nextConfig;
