#!/usr/bin/env tsx
/**
 * Publishing agent — standalone script for publishing approved content.
 * Delegates to the CLI publish command logic.
 *
 * Usage:
 *   npm run publish
 *   npx tsx src/agents/publish.ts --channel twitter --dry-run
 */
import { Command } from "commander";
import { registerPublishCommand } from "../cli/commands/publish.js";

const program = new Command();
program.name("publish-agent");
registerPublishCommand(program);
program.parse(["node", "publish", "publish", ...process.argv.slice(2)]);
