import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    const apiProxyUrl = process.env.API_PROXY_URL ?? "http://127.0.0.1:3001";
    return [{ source: "/api/:path*", destination: `${apiProxyUrl}/:path*` }];
  },
};

export default nextConfig;
