import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  // Required
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // X/Twitter (optional — features disabled if missing)
  X_CONSUMER_KEY: z.string().optional(),
  X_CONSUMER_KEY_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  X_CLIENT_SECRET_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  // Reddit (optional)
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  REDDIT_USER_AGENT: z.string().optional().default("pincerpay-marketing-automation/1.0.0"),

  // YouTube (optional)
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),

  // Discord (optional)
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_ANNOUNCEMENT_CHANNEL_ID: z.string().optional(),
  DISCORD_SUPPORT_CHANNEL_ID: z.string().optional(),

  // Blog (path to pincerpay repo)
  PINCERPAY_REPO_PATH: z.string().optional(),

  // Defaults
  DEFAULT_MODEL: z.string().optional().default("claude-sonnet-4-6"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Environment validation failed:\n${errors}`);
    }
    _env = result.data;
  }
  return _env;
}

export function isChannelConfigured(channel: string): boolean {
  const env = getEnv();
  switch (channel) {
    case "twitter":
      return !!(env.X_CONSUMER_KEY && env.X_CONSUMER_KEY_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET);
    case "reddit":
      return !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_USERNAME && env.REDDIT_PASSWORD);
    case "youtube":
      return !!(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_REFRESH_TOKEN);
    case "discord":
      return !!(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID);
    case "blog":
      return !!env.PINCERPAY_REPO_PATH;
    default:
      return false;
  }
}
