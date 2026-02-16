import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pincerpay/core", "@pincerpay/db"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
