import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Enables forbidden() so edit pages can answer non-authors with a real 403.
    authInterrupts: true,
  },
  images: {
    remotePatterns: [
      // DigitalOcean Spaces origin and CDN hosts (e.g. larder-images.nyc3.cdn.digitaloceanspaces.com)
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
    ],
  },
};

export default nextConfig;
