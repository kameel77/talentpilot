import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
