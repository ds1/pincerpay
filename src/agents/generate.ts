#!/usr/bin/env tsx
import dayjs from "dayjs";
import { parseArgs } from "node:util";
import { generateContent } from "../lib/claude.js";
import { composeSystemPrompt } from "../lib/prompt-loader.js";
import { writeContent, contentExists } from "../lib/content-store.js";
import { getDueEntries, generateContentId, getCurrentWeek } from "../lib/calendar.js";
import { getEnv } from "../lib/env.js";
import { log } from "../lib/logger.js";
import type { CalendarEntry, Channel, ContentPiece } from "../types/index.js";

const { values } = parseArgs({
  options: {
    channel: { type: "string", short: "c" },
    week: { type: "string", short: "w" },
    topic: { type: "string", short: "t" },
    type: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    model: { type: "string", short: "m" },
    verbose: { type: "boolean", short: "v", default: false },
  },
  strict: false,
});

async function generateFromCalendar(): Promise<void> {
  const week = (values.week as string) ?? getCurrentWeek();
  const channel = values.channel as Channel | undefined;

  log.header(`Generating content for ${week}${channel ? ` (${channel} only)` : ""}`);

  const dueEntries = getDueEntries({ week, channel });

  if (dueEntries.length === 0) {
    log.info("No content due for generation. All calendar entries already have drafts.");
    return;
  }

  log.info(`Found ${dueEntries.length} content items to generate`);

  let generated = 0;
  let failed = 0;

  for (const entry of dueEntries) {
    try {
      await generateFromEntry(entry);
      generated++;
    } catch (error) {
      failed++;
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to generate ${entry.type} for ${entry.channel} ("${entry.topic.slice(0, 50)}..."): ${msg}`);
    }
  }

  if (failed > 0) {
    log.warn(`Generation complete. Generated: ${generated} | Failed: ${failed}`);
  } else {
    log.success(`Generation complete. ${generated} drafts created in content/drafts/`);
  }
}

async function generateFromTopic(): Promise<void> {
  const topic = values.topic as string;
  const channel = (values.channel as Channel) ?? "twitter";
  const type = (values.type as string) ?? (channel === "twitter" ? "tweet" : "blog-post");

  const entry: CalendarEntry = {
    week: getCurrentWeek(),
    start_date: dayjs().format("YYYY-MM-DD"),
    channel,
    type: type as CalendarEntry["type"],
    topic,
    scheduled_for: dayjs().add(1, "day").toISOString(),
  };

  log.header(`Generating ad-hoc ${type} for ${channel}`);
  await generateFromEntry(entry);
  log.success("Draft created in content/drafts/");
}

async function generateFromEntry(entry: CalendarEntry): Promise<void> {
  const id = generateContentId(entry);

  if (contentExists(id)) {
    log.dim(`  Skipping "${entry.topic.slice(0, 50)}..." — already exists`);
    return;
  }

  log.info(`${log.channel(entry.channel)} Generating ${entry.type}: "${entry.topic.slice(0, 60)}..."`);

  if (values["dry-run"]) {
    log.dim("  [dry-run] Would generate content here");
    return;
  }

  const env = getEnv();
  const model = (values.model as string) ?? env.DEFAULT_MODEL;

  // Compose the system prompt with brand voice + channel rules + template
  const systemPrompt = composeSystemPrompt(entry.channel, entry.type);

  // Build the user message
  const userMessage = buildUserMessage(entry);

  log.verbose(`  Model: ${model}`, values.verbose as boolean);
  log.verbose(`  System prompt: ${systemPrompt.length} chars`, values.verbose as boolean);

  const body = await generateContent({
    systemPrompt,
    userMessage,
    model,
  });

  // Create the content piece
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
    metrics: {
      impressions: null,
      engagement: null,
      clicks: null,
      pulled_at: null,
    },
  };

  const filepath = writeContent("draft", piece, body);
  log.success(`  → ${filepath}`);
}

function buildUserMessage(entry: CalendarEntry): string {
  const parts = [
    `Generate a ${entry.type} for ${entry.channel} on the following topic:`,
    "",
    entry.topic,
    "",
    `Calendar week: ${entry.week}`,
    `Scheduled date: ${dayjs(entry.scheduled_for).format("YYYY-MM-DD")}`,
  ];

  if (entry.subreddit) {
    parts.push(`Target subreddit: r/${entry.subreddit}`);
  }

  if (entry.theme) {
    parts.push(`Weekly theme: ${entry.theme}`);
  }

  return parts.join("\n");
}

// Main
async function main(): Promise<void> {
  try {
    if (values.topic) {
      await generateFromTopic();
    } else {
      await generateFromCalendar();
    }
  } catch (error) {
    if (error instanceof Error) {
      log.error(error.message);
      if (values.verbose) console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
