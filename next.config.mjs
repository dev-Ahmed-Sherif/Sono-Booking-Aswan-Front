// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function backendOriginForRewrites() {
  const raw = (process.env.NEXT_PUBLIC_BACK_END ?? "http://localhost:57951")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v\d+$/i, "")
    .replace(/\/wwwroot$/i, "");
  return raw || "http://localhost:57951";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "57951",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    const backend = backendOriginForRewrites();
    // Fallback only when NEXT_PUBLIC_*_HUB_URL is unset — rewrites do not proxy
    // SignalR WebSocket/SSE/long-poll streams reliably; browser connects direct to API.
    return [
      {
        source: "/api/v1/hubs/:path*",
        destination: `${backend}/api/v1/hubs/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
