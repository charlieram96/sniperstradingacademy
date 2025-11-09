import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Allow up to 50MB for file uploads (academy PDFs/videos)
    },
  },
};

export default nextConfig;
