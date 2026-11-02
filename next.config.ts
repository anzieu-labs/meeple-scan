import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Tailwind's CSS in the page itself: no stylesheet to wait for before the first paint.
    inlineCss: true,
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // BoardGameGeek box art.
    remotePatterns: [{ protocol: "https", hostname: "cf.geekdo-images.com" }],
  },
};

export default nextConfig;
