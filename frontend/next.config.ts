import type { NextConfig } from "next";

// The browser only talks to this site; /api/* is forwarded to the FastAPI backend.
// That keeps everything behind one address (and one tunnel/domain) and avoids CORS.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  },
  // FastAPI routes like /predict/ need their trailing slash preserved
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
