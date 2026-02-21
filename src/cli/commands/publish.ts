import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import chalk from "chalk";
import { confirm, input } from "@inquirer/prompts";
import { listContent, moveContent } from "../../lib/content-store.js";
import { getEnv, isChannelConfigured } from "../../lib/env.js";
import { log } from "../../lib/logger.js";
import type { Channel, ContentFile, PlatformPublishResult } from "../../types/index.js";

export function registerPublishCommand(program: Command): void {
  program
    .command("publish")
    .description("Publish approved content to platforms")
    .option("-c, --channel <channel>", "Filter by channel")
    .option("--id <id>", "Publish specific content by ID")
    .option("--scheduled", "Only publish items where scheduled_for <= now")
    .option("--dry-run", "Show what would be published without calling APIs")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("-v, --verbose", "Verbose output")
    .option("--manual", "Manual publish: copy-paste content, then record platform URL")
    .action(async (opts) => {
      try {
        const channel = opts.channel as Channel | undefined;
        let items = listContent("approved", { channel });

        if (opts.id) {
          items = items.filter((i) => i.frontmatter.id === opts.id);
        }

        if (opts.scheduled) {
          items = items.filter(
            (i) =>
              i.frontmatter.scheduled_for &&
              dayjs(i.frontmatter.scheduled_for).isBefore(dayjs())
          );
        }

        if (items.length === 0) {
          log.info("No approved content ready to publish.");
          return;
        }

        log.header(`Publishing ${items.length} item(s)`);

        for (const item of items) {
          console.log(
            `  ${log.channel(item.frontmatter.channel)} ${item.frontmatter.type}: ${item.frontmatter.title.slice(0, 60)}`
          );
        }
        console.log();

        if (opts.dryRun) {
          log.info("[dry-run] Would publish the items listed above.");
          return;
        }

        if (opts.manual) {
          let published = 0;
          for (const item of items) {
            const done = await manualPublishItem(item);
            if (done) published++;
          }
          console.log();
          log.info(`Manually published: ${published} / ${items.length}`);
          return;
        }

        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Publish ${items.length} item(s)?`,
          });
          if (!confirmed) {
            log.info("Cancelled.");
            return;
          }
        }

        let published = 0;
        let failed = 0;

        for (const item of items) {
          const result = await publishItem(item, opts.verbose ?? false);
          if (result.success) {
            moveContent(item.filepath, "published", {
              platform_id: result.platform_id ?? null,
              platform_url: result.platform_url ?? null,
              published_at: dayjs().toISOString(),
            });
            log.success(`Published: ${item.frontmatter.id} → ${result.platform_url ?? "done"}`);
            published++;
          } else {
            log.error(`Failed: ${item.frontmatter.id} — ${result.error}`);
            failed++;
          }
        }

        console.log();
        log.info(`Published: ${published} | Failed: ${failed}`);
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

const COMPOSE_URLS: Partial<Record<Channel, string>> = {
  twitter: "https://x.com/compose/tweet",
  reddit: "https://www.reddit.com/submit",
  discord: "https://discord.com/channels/@me",
};

async function manualPublishItem(item: ContentFile): Promise<boolean> {
  const { channel, title, type } = item.frontmatter;

  log.header(`${channel} / ${type}: ${title}`);

  // Display content for copy-paste
  console.log();
  console.log(chalk.dim("─── content ───────────────────────────────────────"));
  console.log(item.body);
  console.log(chalk.dim("──────────────────────────────────────────────────"));
  console.log();

  const composeUrl = COMPOSE_URLS[channel];
  if (composeUrl) {
    log.info(`Compose URL: ${chalk.underline(composeUrl)}`);
  }

  const shouldPublish = await confirm({
    message: "Did you publish this content?",
  });

  if (!shouldPublish) {
    log.dim("  Skipped.");
    return false;
  }

  const platformUrl = await input({
    message: "Platform URL (paste link, or leave blank):",
  });

  moveContent(item.filepath, "published", {
    platform_url: platformUrl || "manual",
    published_at: dayjs().toISOString(),
  });

  log.success(`Marked published: ${item.frontmatter.id}`);
  return true;
}

async function publishItem(item: ContentFile, verbose: boolean): Promise<PlatformPublishResult> {
  const { channel } = item.frontmatter;

  if (!isChannelConfigured(channel)) {
    return {
      success: false,
      error: `${channel} API not configured. Set keys in .env`,
    };
  }

  try {
    switch (channel) {
      case "twitter":
        return await publishToTwitter(item, verbose);
      case "reddit":
        return await publishToReddit(item, verbose);
      case "youtube":
        return await publishToYouTube(item, verbose);
      case "discord":
        return await publishToDiscord(item, verbose);
      case "blog":
        return await publishToBlog(item, verbose);
      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function publishToTwitter(item: ContentFile, verbose: boolean): Promise<PlatformPublishResult> {
  const { postTweet, postThread } = await import("../../lib/twitter.js");

  if (item.frontmatter.type === "thread") {
    const tweets = item.body
      .split(/^## Tweet \d+\/\d+$/m)
      .map((t) => t.trim())
      .filter(Boolean);

    log.verbose(`  Posting thread with ${tweets.length} tweets`, verbose);
    const result = await postThread(tweets);
    return { success: true, platform_id: result.ids[0], platform_url: result.url };
  } else {
    log.verbose(`  Posting tweet: ${item.body.slice(0, 50)}...`, verbose);
    const result = await postTweet(item.body.trim());
    return { success: true, platform_id: result.id, platform_url: result.url };
  }
}

async function publishToReddit(item: ContentFile, verbose: boolean): Promise<PlatformPublishResult> {
  const { submitPost } = await import("../../lib/reddit.js");

  // Parse title and body from reddit-post format
  const titleMatch = item.body.match(/^## Title\n(.+)/m);
  const bodyMatch = item.body.match(/^## Body\n([\s\S]+?)(?=^## |$)/m);

  const title = titleMatch?.[1]?.trim() ?? item.frontmatter.title;
  const body = bodyMatch?.[1]?.trim() ?? item.body;
  const subreddit = item.frontmatter.subreddit ?? "solana";

  log.verbose(`  Posting to r/${subreddit}: "${title.slice(0, 50)}..."`, verbose);
  const result = await submitPost(subreddit, title, body);
  return { success: true, platform_id: result.id, platform_url: result.url };
}

async function publishToYouTube(item: ContentFile, _verbose: boolean): Promise<PlatformPublishResult> {
  // YouTube descriptions are generated but video upload is manual
  return {
    success: true,
    platform_url: "manual-upload-required",
  };
}

async function publishToDiscord(item: ContentFile, verbose: boolean): Promise<PlatformPublishResult> {
  const { sendAnnouncement } = await import("../../lib/discord.js");

  log.verbose(`  Sending Discord announcement`, verbose);
  const result = await sendAnnouncement(item.body.trim());
  return { success: true, platform_id: result.id, platform_url: result.url };
}

async function publishToBlog(item: ContentFile, verbose: boolean): Promise<PlatformPublishResult> {
  const env = getEnv();
  const repoPath = env.PINCERPAY_REPO_PATH;
  if (!repoPath) {
    return { success: false, error: "PINCERPAY_REPO_PATH not set in .env" };
  }

  const blogDir = path.join(repoPath, "apps", "dashboard", "content", "blog");
  if (!fs.existsSync(blogDir)) {
    return { success: false, error: `Blog directory not found: ${blogDir}` };
  }

  // Generate slug from title
  const slug = item.frontmatter.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  // Strip the internal body content — remove the embedded YAML frontmatter block if present
  let blogBody = item.body.trim();
  // Remove ```yaml ... ``` block at the start (our template wraps frontmatter in a code block)
  blogBody = blogBody.replace(/^```yaml\n---[\s\S]*?---\n```\n*/, "").trim();

  // Build the site-compatible frontmatter
  const date = item.frontmatter.scheduled_for
    ? dayjs(item.frontmatter.scheduled_for).format("YYYY-MM-DD")
    : dayjs().format("YYYY-MM-DD");

  const tags = item.frontmatter.tags?.length
    ? item.frontmatter.tags
    : ["pincerpay", "x402"];

  // Extract description from first paragraph if not in frontmatter
  const firstParagraph = blogBody
    .split("\n\n")
    .find((p) => p && !p.startsWith("#"))
    ?.replace(/\n/g, " ")
    .slice(0, 160);

  const description = firstParagraph ?? item.frontmatter.topic_brief.slice(0, 160);

  const siteContent = [
    "---",
    `title: "${item.frontmatter.title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `author: "PincerPay Team"`,
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
    blogBody,
    "",
  ].join("\n");

  const filepath = path.join(blogDir, `${slug}.md`);
  log.verbose(`  Writing blog post to ${filepath}`, verbose);
  fs.writeFileSync(filepath, siteContent, "utf-8");

  const url = `https://pincerpay.com/blog/${slug}`;
  log.info(`  Blog post written to ${filepath}`);
  log.info(`  URL (after deploy): ${url}`);
  log.info(`  To publish: cd ${repoPath} && git add . && git commit && git push`);

  return { success: true, platform_url: url };
}
