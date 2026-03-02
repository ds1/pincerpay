import type { Command } from "commander";
import { log } from "../../lib/logger.js";

export function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Generate KPI report")
    .option("-m, --month <month>", "Target month (e.g., 2026-03)")
    .option("-c, --channel <channel>", "Filter by channel")
    .action(async (opts) => {
      log.warn("Report generation not yet implemented. Coming in Phase 5.");
      log.info("This command will compare actual metrics against KPI targets from config/kpis.yaml.");
    });
}
