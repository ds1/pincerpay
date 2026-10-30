import { createRequire } from "node:module";

/**
 * The published package version. Read at runtime because package.json sits
 * outside rootDir (src); the relative path is the same from src/ and dist/.
 */
export const PACKAGE_VERSION = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;
