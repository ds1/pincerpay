import type { Command } from "commander";
import dayjs from "dayjs";
import { generateContent } from "../../lib/claude.js";
import { composeSystemPrompt } from "../../lib/prompt-loader.js";
import { writeContent, contentExists } from "../../lib/content-store.js";
import { getDueEntries, generateContentId, getCurrentWeek } from "../../lib/calendar.js";
import { getEnv } from "../../lib/env.js";
import { log } from "../../lib/logger.js";
import type { CalendarEntry, Channel, ContentPiece } from "../../types/index.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate content from calendar or ad-hoc topic")
    .option("-c, --channel <channel>", "Filter by channel (twitter, reddit, youtube, discord, blog)")
    .option("-w, --week <week>", "Target week (e.g., week-1)")
    .option("-t, --topic <topic>", "Ad-hoc topic (bypasses calendar)")
    .option("--type <type>", "Content type for ad-hoc (tweet, thread, reddit-post, etc.)")
    .option("-m, --model <model>", "Override Claude model")
    .option("--dry-run", "Show what would be generated without calling API")
    .option("-v, --verbose", "Verbose output")
    .action(async (opts) => {
      try {
        if (opts.topic) {
          await generateAdHoc(opts);
        } else {
          await generateFromCalendar(opts);
        }
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

async function generateFromCalendar(opts: {
  channel?: string;
  week?: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const week = opts.week ?? getCurrentWeek();
  const channel = opts.channel as Channel | undefined;

  log.header(`Generating content for ${week}${channel ? ` (${channel} only)` : ""}`);

  const dueEntries = getDueEntries({ week, channel });

  if (dueEntries.length === 0) {
    log.info("No content due for generation. All calendar entries already have drafts.");
    return;
  }

  log.info(`Found ${dueEntries.length} content items to generate`);

  for (const entry of dueEntries) {
    await generateEntry(entry, opts);
  }

  log.success(`Done. ${dueEntries.length} drafts created in content/drafts/`);
}

async function generateAdHoc(opts: {
  topic: string;
  channel?: string;
  type?: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const channel = (opts.channel ?? "twitter") as Channel;
  const type = (opts.type ?? (channel === "twitter" ? "tweet" : "blog-post")) as CalendarEntry["type"];

  const entry: CalendarEntry = {
    week: getCurrentWeek(),
    start_date: dayjs().format("YYYY-MM-DD"),
    channel,
    type,
    topic: opts.topic,
    scheduled_for: dayjs().add(1, "day").toISOString(),
  };

  log.header(`Generating ad-hoc ${type} for ${channel}`);
  await generateEntry(entry, opts);
  log.success("Draft created in content/drafts/");
}

async function generateEntry(
  entry: CalendarEntry,
  opts: { model?: string; dryRun?: boolean; verbose?: boolean }
): Promise<void> {
  const id = generateContentId(entry);

  if (contentExists(id)) {
    log.dim(`  Skipping "${entry.topic.slice(0, 50)}..." — already exists`);
    return;
  }

  log.info(`${log.channel(entry.channel)} Generating ${entry.type}: "${entry.topic.slice(0, 60)}..."`);

  if (opts.dryRun) {
    log.dim("  [dry-run] Would generate content here");
    return;
  }

  const env = getEnv();
  // Blog posts use Opus for higher quality long-form; everything else uses default (Sonnet)
  const model = opts.model ?? (entry.channel === "blog" ? "claude-opus-4-6" : env.DEFAULT_MODEL);
  const systemPrompt = composeSystemPrompt(entry.channel, entry.type);

  const userMessage = [
    `Generate a ${entry.type} for ${entry.channel} on the following topic:`,
    "",
    entry.topic,
    "",
    `Calendar week: ${entry.week}`,
    `Scheduled date: ${dayjs(entry.scheduled_for).format("YYYY-MM-DD")}`,
    entry.subreddit ? `Target subreddit: r/${entry.subreddit}` : "",
    entry.theme ? `Weekly theme: ${entry.theme}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  log.verbose(`  Model: ${model}`, opts.verbose ?? false);

  const body = await generateContent({ systemPrompt, userMessage, model });

  const piece: ContentPiece = {
    id,
    title: entry.topic.slice(0, 80),
    channel: entry.channel,
    type: entry.type,
    status: "draft",
    created_at: dayjs().toISOString(),
    updated_at: dayjs().toISOString(),
    scheduled_for: entry.scheduled_for,
    published_at: null,
    platform_id: null,
    platform_url: null,
    calendar_week: entry.week,
    topic_brief: entry.topic,
    tags: [],
    generation_model: model,
    review_notes: "",
    rejection_reason: "",
    ...(entry.subreddit ? { subreddit: entry.subreddit } : {}),
    metrics: { impressions: null, engagement: null, clicks: null, pulled_at: null },
  };

  const filepath = writeContent("draft", piece, body);
  log.success(`  → ${filepath}`);
}
