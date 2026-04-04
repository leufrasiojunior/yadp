/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async rewrites() {
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ?? process.env.INTERNAL_API_BASE_URL ?? "http://127.0.0.1:3001/api";

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
