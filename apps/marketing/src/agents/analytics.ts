#!/usr/bin/env tsx
/**
 * Analytics agent — pulls metrics from platform APIs for published content.
 * Stub implementation — Phase 5.
 */
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { listContent, updateFrontmatter } from "../lib/content-store.js";

dayjs.extend(relativeTime);
import { isChannelConfigured } from "../lib/env.js";
import { log } from "../lib/logger.js";

async function main(): Promise<void> {
  log.header("Analytics Pull");

  const published = listContent("published");

  if (published.length === 0) {
    log.info("No published content to pull metrics for.");
    return;
  }

  let pulled = 0;

  for (const item of published) {
    const { channel } = item.frontmatter;

    if (!isChannelConfigured(channel)) {
      log.dim(`  Skipping ${item.frontmatter.id} — ${channel} not configured`);
      continue;
    }

    if (!item.frontmatter.platform_id) {
      log.dim(`  Skipping ${item.frontmatter.id} — no platform ID`);
      continue;
    }

    // Skip if metrics were pulled recently (< 6 hours ago)
    if (item.frontmatter.metrics.pulled_at) {
      const lastPull = dayjs(item.frontmatter.metrics.pulled_at);
      if (dayjs().diff(lastPull, "hours") < 6) {
        log.dim(`  Skipping ${item.frontmatter.id} — pulled ${lastPull.fromNow()}`);
        continue;
      }
    }

    try {
      log.info(`${log.channel(channel)} Pulling metrics for ${item.frontmatter.id}`);

      const metrics = await pullMetrics(channel, item.frontmatter.platform_id);

      updateFrontmatter(item.filepath, {
        metrics: {
          ...metrics,
          pulled_at: dayjs().toISOString(),
        },
      });

      log.success(`  Impressions: ${metrics.impressions ?? "n/a"} | Engagement: ${metrics.engagement ?? "n/a"}`);
      pulled++;
    } catch (error) {
      log.error(`  Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log.info(`Pulled metrics for ${pulled} items.`);
}

async function pullMetrics(
  channel: string,
  platformId: string
): Promise<{ impressions: number | null; engagement: number | null; clicks: number | null }> {
  switch (channel) {
    case "twitter": {
      const { getTweetMetrics } = await import("../lib/twitter.js");
      const m = await getTweetMetrics(platformId);
      return {
        impressions: m.impressions,
        engagement: m.likes + m.retweets + m.replies,
        clicks: null,
      };
    }
    case "reddit": {
      const { getPostMetrics } = await import("../lib/reddit.js");
      const m = await getPostMetrics(platformId);
      return {
        impressions: null,
        engagement: m.upvotes + m.comments,
        clicks: null,
      };
    }
    case "youtube": {
      const { getVideoMetrics } = await import("../lib/youtube.js");
      const m = await getVideoMetrics(platformId);
      return {
        impressions: m.views,
        engagement: m.likes + m.comments,
        clicks: null,
      };
    }
    default:
      return { impressions: null, engagement: null, clicks: null };
  }
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
