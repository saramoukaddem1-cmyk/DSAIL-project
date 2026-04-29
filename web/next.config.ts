import type { NextConfig } from "next";

const onOneDriveWin =
  process.platform === "win32" && /[\\/]OneDrive[\\/]/i.test(process.cwd());

const nextConfig: NextConfig = {
  // Quiets dev warning when opening http://127.0.0.1:3000 while dev says localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /** Avoids flaky RSC / client-manifest errors from the segment explorer in dev (common with OneDrive + watchers). */
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  // OneDrive file sync races native file watchers; polling avoids missing .next manifests in dev.
  webpack: (config, { dev }) => {
    if (dev && onOneDriveWin) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 500,
      };
    }
    return config;
  },
};

export default nextConfig;
