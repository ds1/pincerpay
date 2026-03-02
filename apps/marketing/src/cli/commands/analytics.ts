import type { Command } from "commander";
import { log } from "../../lib/logger.js";

export function registerAnalyticsCommand(program: Command): void {
  program
    .command("analytics")
    .description("Pull metrics from platforms")
    .argument("[action]", "Action: pull", "pull")
    .option("-c, --channel <channel>", "Filter by channel")
    .option("-d, --days <days>", "Number of days to look back", "7")
    .action(async (_action, opts) => {
      log.warn("Analytics agent not yet implemented. Coming in Phase 5.");
      log.info("This command will pull metrics from Twitter, Reddit, YouTube, and Discord APIs.");
    });
}
