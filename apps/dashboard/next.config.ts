import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pincerpay/core", "@pincerpay/db"],
};

export default nextConfig;
