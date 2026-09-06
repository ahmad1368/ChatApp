/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@chatapp/shared"],
  // Serving built JS/CSS/image assets from a CDN origin instead of the app
  // server is Next.js's built-in mechanism for this — set NEXT_PUBLIC_CDN_URL
  // in production once a CDN is fronting the deployment. Left unset, assets
  // are served from the app itself exactly as before.
  assetPrefix: process.env.NEXT_PUBLIC_CDN_URL || undefined,
  async headers() {
    return [
      {
        // PWA icons (see #1) are static and content-stable — safe to cache
        // aggressively so a CDN or browser doesn't refetch them every load.
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

module.exports = nextConfig;
