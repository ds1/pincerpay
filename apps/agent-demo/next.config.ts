import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  output: isVercel ? "standalone" : undefined,
  outputFileTracingRoot: isVercel ? path.join(__dirname, "../../") : undefined,
  transpilePackages: ["@pincerpay/agent", "@pincerpay/merchant", "@pincerpay/core"],
  serverExternalPackages: ["@x402/hono", "@x402/core", "@x402/evm", "@x402/svm"],
  webpack: (config) => {
    // Prevent css-loader from resolving @import "tailwindcss" before PostCSS.
    // Tailwind v4's @tailwindcss/postcss plugin needs to handle this import.
    const cssRules = config.module?.rules?.find(
      (r: { oneOf?: unknown }) => r?.oneOf
    );
    if (cssRules?.oneOf) {
      for (const rule of cssRules.oneOf) {
        if (Array.isArray(rule.use)) {
          for (const loader of rule.use) {
            if (
              typeof loader === "object" &&
              loader.loader?.includes("css-loader") &&
              loader.options
            ) {
              loader.options.import = {
                ...loader.options.import,
                filter: (url: string) => !url.includes("tailwindcss"),
              };
            }
          }
        }
      }
    }
    return config;
  },
};

export default nextConfig;
