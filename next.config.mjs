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

function backendImageRemotePatterns() {
  const patterns = [
    {
      protocol: "http",
      hostname: "localhost",
      port: "57951",
      pathname: "/**",
    },
    {
      protocol: "http",
      hostname: "localhost",
      port: "5033",
      pathname: "/**",
    },
  ];

  const raw = (process.env.NEXT_PUBLIC_BACK_END ?? "").trim();
  if (!raw) return patterns;

  try {
    const origin = raw.startsWith("http") ? raw : `http://${raw}`;
    const parsed = new URL(origin);
    const protocol = parsed.protocol.replace(":", "");
    patterns.push({
      protocol,
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: "/**",
    });
    if (protocol === "http") {
      patterns.push({
        protocol: "https",
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: "/**",
      });
    }
  } catch {
    // Keep localhost defaults only.
  }

  return patterns;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: backendImageRemotePatterns(),
  },
  async rewrites() {
    const backend = backendOriginForRewrites();
    // Fallback only when NEXT_PUBLIC_*_HUB_URL is unset — rewrites do not proxy
    // SignalR WebSocket/SSE/long-poll streams reliably; browser connects direct to API.
    // Attach/wwwroot rewrites serve backend files over HTTPS (avoids mixed-content on Vercel).
    return [
      {
        source: "/Attach/:path*",
        destination: `${backend}/Attach/:path*`,
      },
      {
        source: "/attach/:path*",
        destination: `${backend}/Attach/:path*`,
      },
      {
        source: "/wwwroot/:path*",
        destination: `${backend}/wwwroot/:path*`,
      },
      {
        source: "/api/v1/hubs/:path*",
        destination: `${backend}/api/v1/hubs/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
