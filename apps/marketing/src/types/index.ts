export const CHANNELS = ["twitter", "reddit", "youtube", "discord", "blog"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONTENT_TYPES = [
  "tweet",
  "thread",
  "reddit-post",
  "youtube-description",
  "discord-announcement",
  "blog-post",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ["draft", "approved", "published", "rejected"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentMetrics {
  impressions: number | null;
  engagement: number | null;
  clicks: number | null;
  pulled_at: string | null;
}

export interface ContentPiece {
  id: string;
  title: string;
  channel: Channel;
  type: ContentType;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  published_at: string | null;
  platform_id: string | null;
  platform_url: string | null;
  calendar_week: string | null;
  topic_brief: string;
  tags: string[];
  generation_model: string;
  review_notes: string;
  rejection_reason: string;
  subreddit?: string;
  metrics: ContentMetrics;
}

export interface ContentFile {
  frontmatter: ContentPiece;
  body: string;
  filepath: string;
}

export interface ContentFilter {
  channel?: Channel;
  type?: ContentType;
  status?: ContentStatus;
  week?: string;
  tags?: string[];
}

export interface CalendarEntry {
  week: string;
  start_date: string;
  channel: Channel;
  type: ContentType;
  topic: string;
  scheduled_for: string;
  subreddit?: string;
  theme?: string;
  notes?: string;
}

export interface CalendarWeek {
  week: string;
  start_date: string;
  theme: string;
  content: Omit<CalendarEntry, "week" | "start_date" | "theme">[];
}

export interface ChannelConfig {
  handle?: string;
  username?: string;
  channel_id?: string;
  guild_id?: string;
  frequency: string;
  max_tweet_length?: number;
  max_thread_length?: number;
  rate_limit_tweets_per_3hr?: number;
  subreddits?: string[];
  self_promo_ratio?: string;
  announcement_channel_id?: string;
  support_channel_id?: string;
  output_dir?: string;
}

export interface KpiTarget {
  channel: Channel;
  month: string;
  metrics: Record<string, number>;
}

export interface GenerateOptions {
  channel?: Channel;
  week?: string;
  topic?: string;
  dryRun?: boolean;
  model?: string;
  verbose?: boolean;
}

export interface PublishOptions {
  channel?: Channel;
  id?: string;
  scheduled?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  verbose?: boolean;
}

export interface ReviewAction {
  type: "approve" | "edit" | "reject" | "regenerate" | "ai-review" | "skip";
  feedback?: string;
}

export interface PlatformPublishResult {
  success: boolean;
  platform_id?: string;
  platform_url?: string;
  error?: string;
}
