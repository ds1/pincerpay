import type { Command } from "commander";
import { listContent } from "../../lib/content-store.js";
import { log } from "../../lib/logger.js";
import { reviewContentInteractive } from "../ui/reviewer.js";
import type { Channel } from "../../types/index.js";

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Interactive review of draft content")
    .option("-c, --channel <channel>", "Filter by channel")
    .option("--id <id>", "Review specific content by ID")
    .action(async (opts) => {
      try {
        const channel = opts.channel as Channel | undefined;
        let items = listContent("draft", { channel });

        if (opts.id) {
          items = items.filter((i) => i.frontmatter.id === opts.id);
        }

        if (items.length === 0) {
          log.info("No drafts to review." + (channel ? ` (filtered: ${channel})` : ""));
          return;
        }

        await reviewContentInteractive(items);
      } catch (error) {
        if (error instanceof Error && error.message.includes("User force closed")) {
          console.log();
          log.info("Review cancelled.");
          return;
        }
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
