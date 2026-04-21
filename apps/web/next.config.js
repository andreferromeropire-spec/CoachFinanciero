const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*(\/api\/budget|\/api\/transactions|\/api\/analytics)/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|ico|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-images",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.1.4"],
  transpilePackages: ["@coach/db"],
  // Cloudflare Pages inyecta CF_PAGES_COMMIT_SHA en el build; sirve para comprobar que el front desplegado coincide con Git.
  env: {
    NEXT_PUBLIC_PAGES_BUILD_SHA:
      process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "",
  },
};

module.exports = withPWA(nextConfig);
