import type { Command } from "commander";
import { getCalendarEntries, getCalendarWithStatus, getCurrentWeek } from "../../lib/calendar.js";
import { log } from "../../lib/logger.js";
import { formatCalendarTable } from "../ui/formatters.js";
import type { Channel } from "../../types/index.js";

export function registerCalendarCommand(program: Command): void {
  program
    .command("calendar")
    .description("View content calendar")
    .option("-w, --week <week>", "Specific week (e.g., week-1)")
    .option("-m, --month <month>", "Full month (e.g., 2026-03)")
    .option("-c, --channel <channel>", "Filter by channel")
    .option("-s, --status", "Show with generation/publish status overlay")
    .action((opts) => {
      try {
        const filter = {
          week: opts.week as string | undefined,
          month: opts.month as string | undefined,
          channel: opts.channel as Channel | undefined,
        };

        // Default to current week if no filter
        if (!filter.week && !filter.month) {
          filter.week = getCurrentWeek();
        }

        if (opts.status) {
          const entries = getCalendarWithStatus(filter);
          log.header(`Content Calendar ${filter.week ?? filter.month ?? ""} (with status)`);
          formatCalendarTable(entries);
        } else {
          const entries = getCalendarEntries(filter);
          log.header(`Content Calendar ${filter.week ?? filter.month ?? ""}`);
          formatCalendarTable(entries);
        }
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
