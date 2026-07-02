const parsedWebpackPollIntervalMs = Number.parseInt(process.env.NEXT_WEBPACK_POLL_INTERVAL_MS ?? "", 10);
const webpackPollIntervalMs =
  Number.isFinite(parsedWebpackPollIntervalMs) && parsedWebpackPollIntervalMs > 0 ? parsedWebpackPollIntervalMs : 1000;
const useWebpackPolling = process.env.NEXT_WEBPACK_USEPOLLING === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  ...(useWebpackPolling
    ? {
        watchOptions: {
          pollIntervalMs: webpackPollIntervalMs,
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: "/notifications-sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
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
