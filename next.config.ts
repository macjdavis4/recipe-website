import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // DigitalOcean Spaces origin and CDN hosts (e.g. larder-images.nyc3.cdn.digitaloceanspaces.com)
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
    ],
  },
};

export default nextConfig;
