import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal production runtime: .next/standalone contains server.js + only
  // the node_modules actually imported. Image size drops from ~1.5GB to ~150MB,
  // cold start from ~10s to ~1s.
  output: "standalone",
  serverExternalPackages: [],
  allowedDevOrigins: ["app.talentpilot.io", "localhost:3000"],
  async redirects() {
    return [
      {
        source: "/accept-invitation",
        destination: "/join",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
