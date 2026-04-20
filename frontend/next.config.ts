import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
