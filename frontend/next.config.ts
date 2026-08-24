import type { NextConfig } from "next";

// The backend mounts everything under /api/v1. Adding the version segment here
// means every call site can keep using plain "/api/..." paths, and the browser
// only ever talks to this origin - so CORS never enters the picture in dev.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
    },
  ],
};

export default nextConfig;
