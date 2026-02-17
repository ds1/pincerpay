import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "core",
      root: "packages/core",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "solana",
      root: "packages/solana",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "agent",
      root: "packages/agent",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "merchant",
      root: "packages/merchant",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "facilitator",
      root: "apps/facilitator",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
]);
