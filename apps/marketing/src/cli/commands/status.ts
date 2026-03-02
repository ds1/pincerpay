import type { Command } from "commander";
import dayjs from "dayjs";
import { countByStatus, listContent } from "../../lib/content-store.js";
import { isChannelConfigured } from "../../lib/env.js";
import { log } from "../../lib/logger.js";
import { formatStatusDashboard } from "../ui/formatters.js";
import { CHANNELS } from "../../types/index.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Pipeline overview dashboard")
    .action(() => {
      try {
        const counts = countByStatus();
        formatStatusDashboard(counts);

        // Upcoming approved content
        const approved = listContent("approved");
        if (approved.length > 0) {
          log.header("Ready to Publish");
          for (const item of approved.slice(0, 5)) {
            const scheduled = item.frontmatter.scheduled_for
              ? dayjs(item.frontmatter.scheduled_for).format("MMM D")
              : "unscheduled";
            console.log(
              `  ${log.channel(item.frontmatter.channel)} ${item.frontmatter.title.slice(0, 50)} — ${scheduled}`
            );
          }
          if (approved.length > 5) {
            log.dim(`  ... and ${approved.length - 5} more`);
          }
          console.log();
        }

        // Overdue items
        const drafts = listContent("draft");
        const overdue = drafts.filter(
          (d) =>
            d.frontmatter.scheduled_for &&
            dayjs(d.frontmatter.scheduled_for).isBefore(dayjs())
        );
        if (overdue.length > 0) {
          log.header("Overdue Drafts");
          for (const item of overdue) {
            const scheduled = dayjs(item.frontmatter.scheduled_for!).format("MMM D");
            console.log(
              `  ${log.channel(item.frontmatter.channel)} ${item.frontmatter.title.slice(0, 50)} — was due ${scheduled}`
            );
          }
          console.log();
        }

        // Platform API status
        log.header("Platform API Status");
        for (const channel of CHANNELS) {
          const configured = isChannelConfigured(channel);
          console.log(
            `  ${log.channel(channel)} ${configured ? log.status("approved") : log.status("rejected")} ${configured ? "configured" : "not configured"}`
          );
        }
        console.log();
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
