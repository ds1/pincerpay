import chalk from "chalk";
import dayjs from "dayjs";
import type { ContentFile, CalendarEntry } from "../../types/index.js";
import { log } from "../../lib/logger.js";

export function formatContentPreview(content: ContentFile): string {
  const { frontmatter: fm, body } = content;
  const lines: string[] = [];

  lines.push(chalk.bold.white(`  ${fm.title}`));
  lines.push(
    `  ${log.channel(fm.channel)} ${chalk.dim(fm.type)} | ${log.status(fm.status)} | ${chalk.dim(fm.id)}`
  );

  if (fm.scheduled_for) {
    const scheduled = dayjs(fm.scheduled_for);
    const isPast = scheduled.isBefore(dayjs());
    const dateStr = scheduled.format("MMM D, YYYY HH:mm");
    lines.push(
      `  Scheduled: ${isPast ? chalk.red(dateStr + " (overdue)") : chalk.cyan(dateStr)}`
    );
  }

  if (fm.subreddit) {
    lines.push(`  Subreddit: ${chalk.hex("#FF4500")(`r/${fm.subreddit}`)}`);
  }

  if (fm.tags.length > 0) {
    lines.push(`  Tags: ${fm.tags.map((t) => chalk.dim(`#${t}`)).join(" ")}`);
  }

  lines.push("");

  // Show body preview with character count for tweets
  const bodyPreview = body.slice(0, 500);
  if (fm.type === "tweet") {
    const charCount = body.length;
    const overLimit = charCount > 280;
    lines.push(
      `  ${chalk.dim("Characters:")} ${overLimit ? chalk.red(`${charCount}/280 OVER LIMIT`) : chalk.green(`${charCount}/280`)}`
    );
  }

  if (fm.type === "thread") {
    const tweets = body.split(/^## Tweet \d+\/\d+/m).filter(Boolean);
    for (let i = 0; i < tweets.length; i++) {
      const text = tweets[i].trim();
      const charCount = text.length;
      const overLimit = charCount > 280;
      lines.push(
        `  Tweet ${i + 1}: ${overLimit ? chalk.red(`${charCount}/280 OVER`) : chalk.green(`${charCount}/280`)}`
      );
    }
  }

  lines.push(chalk.dim("  ─".repeat(30)));
  for (const line of bodyPreview.split("\n")) {
    lines.push(`  ${line}`);
  }
  if (body.length > 500) {
    lines.push(chalk.dim(`  ... (${body.length - 500} more characters)`));
  }
  lines.push(chalk.dim("  ─".repeat(30)));

  return lines.join("\n");
}

export function formatCalendarTable(
  entries: (CalendarEntry & { content_status?: string; content_id?: string })[]
): void {
  if (entries.length === 0) {
    log.info("No calendar entries found.");
    return;
  }

  const header = ["Date", "Channel", "Type", "Topic", "Status"];
  const rows = entries.map((e) => [
    dayjs(e.scheduled_for).format("MM/DD"),
    e.channel,
    e.type,
    e.topic.slice(0, 50) + (e.topic.length > 50 ? "..." : ""),
    e.content_status ?? "—",
  ]);

  console.log();
  console.log(
    chalk.bold(
      header.map((h, i) => h.padEnd([6, 10, 20, 52, 15][i])).join("  ")
    )
  );
  console.log(chalk.dim("─".repeat(110)));

  for (const row of rows) {
    const [date, channel, type, topic, status] = row;
    console.log(
      [
        chalk.white(date.padEnd(6)),
        log.channel(channel).padEnd(20), // Includes ANSI codes, needs extra padding
        chalk.dim(type.padEnd(20)),
        chalk.white(topic.padEnd(52)),
        log.status(status),
      ].join("  ")
    );
  }
  console.log();
}

export function formatStatusDashboard(counts: Record<string, number>): void {
  log.header("Content Pipeline");

  const items = [
    { label: "Drafts (awaiting review)", count: counts.draft, color: chalk.yellow },
    { label: "Approved (ready to publish)", count: counts.approved, color: chalk.green },
    { label: "Published", count: counts.published, color: chalk.blue },
    { label: "Rejected", count: counts.rejected, color: chalk.red },
  ];

  for (const item of items) {
    const bar = "█".repeat(Math.min(item.count, 30));
    console.log(`  ${item.color(bar)} ${item.count} ${chalk.dim(item.label)}`);
  }
  console.log();
}
