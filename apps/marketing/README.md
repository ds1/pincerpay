# PincerPay Marketing Automation

Local CLI tool for generating, reviewing, and publishing marketing content across X, Reddit, YouTube, Discord, and blog. Uses Claude Sonnet 4.6 for content generation with a comprehensive brand voice guide and channel-specific prompts.

## Quick Start

```bash
npm install
cp .env.example .env
# Add your platform keys to .env

# Preview what content is due this week
npx tsx src/cli/index.ts calendar --status

# Generate content
npx tsx src/cli/index.ts generate --week 2026-W09

# Review and approve drafts
npx tsx src/cli/index.ts review

# Publish approved content
npx tsx src/cli/index.ts publish --dry-run
npx tsx src/cli/index.ts publish
```

## How It Works

```
Content Calendar → Claude API generates drafts → Human reviews → Platform APIs publish
                    (brand voice enforced)        (approve/edit/    (X, Reddit,
                                                   reject/regen)    YouTube, Discord)
```

All content flows through a file-based queue:

```
content/
├── drafts/      ← Generated, awaiting review
├── approved/    ← Reviewed, ready to publish
├── published/   ← Published with platform IDs
└── rejected/    ← Rejected with feedback
```

Each content piece is a markdown file with YAML frontmatter tracking status, channel, schedule, platform IDs, and metrics.

## CLI Commands

| Command | Description |
|---------|-------------|
| `generate` | Generate content from calendar or ad-hoc topic |
| `review` | Interactive review — approve, edit, reject, regenerate, or AI-review |
| `publish` | Publish approved content to platforms |
| `status` | Pipeline dashboard (counts, overdue items, API status) |
| `calendar` | View content calendar with generation status |
| `analytics` | Pull engagement metrics from platforms |
| `report` | KPI report comparing actuals vs targets |

All commands accept `--help` for options. Common flags:

```bash
--channel twitter    # Filter by channel
--dry-run            # Preview without side effects
--week 2026-W09      # Target specific week
--verbose            # Detailed output
```

### Ad-Hoc Content

```bash
# Generate a one-off tweet
npx tsx src/cli/index.ts generate --topic "Hot take on OpenAI's ACP protocol"

# Generate a Reddit post for a specific subreddit
npx tsx src/cli/index.ts generate --topic "How x402 works" --channel reddit --type reddit-post
```

### Interactive Review

The `review` command presents each draft with formatting, character counts, and channel badges, then offers:

- **Approve** — move to `content/approved/`
- **Edit** — open in your `$EDITOR`
- **Reject** — with reason, move to `content/rejected/`
- **Regenerate** — provide feedback, Claude generates a new version
- **AI Review** — Claude critiques the content against the brand voice guide

## Discord Bot

Long-running bot for community management:

```bash
npm run discord-bot
```

Features:
- Welcome new members with onboarding message
- Auto-respond to support questions using Claude (rate-limited)
- Slash commands: `/announce`, `/showcase`

See `scripts/setup-discord.md` for server setup guide.

## Configuration

### Environment Variables (`.env`)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# X (optional — publishing disabled if missing)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Reddit (optional)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=

# YouTube (optional)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=

# Discord (optional)
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_ANNOUNCEMENT_CHANNEL_ID=
DISCORD_SUPPORT_CHANNEL_ID=

# Generation defaults
DEFAULT_MODEL=claude-sonnet-4-6
```

Channels are automatically disabled when their API keys are missing. The `status` command shows which channels are configured.

### Content Calendar

`config/content-calendar.yaml` — 8 weeks of planned content (Weeks 9–16). Each entry defines channel, content type, topic, and scheduled date. Add new weeks by following the existing YAML structure.

### Brand Voice

`config/brand-voice.md` — 4,500-word guide defining tone, vocabulary, anti-patterns, and formatting conventions per channel. Injected into every Claude generation call as part of the system prompt.

### Channel Prompts

`prompts/` — Channel-specific generation rules:
- `twitter.md` — Punchy, opinionated, 280-char limit, thread structure
- `reddit.md` — Value-first, anti-promotional, subreddit-specific notes
- `youtube.md` — Educational, SEO keywords, description template
- `discord.md` — Warm, peer-to-peer, announcement format
- `blog.md` — Substantive, thesis-first, code examples required

## Project Structure

```
├── config/           Brand voice, calendar, channels, KPIs, templates
├── prompts/          System + channel-specific generation prompts
├── content/          File-based content queue (drafts → approved → published)
├── src/
│   ├── agents/       Standalone scripts (generate, publish, analytics, discord-bot)
│   ├── cli/          Commander.js CLI with interactive review TUI
│   ├── lib/          Core utilities (Claude, content store, platform clients)
│   └── types/        TypeScript type definitions
├── scripts/          Setup guides and utilities
└── _planning/        Implementation plans
```

## Tech Stack

- TypeScript + tsx (no build step)
- `@anthropic-ai/sdk` — Claude Sonnet 4.6 for content generation
- `commander` + `@inquirer/prompts` — CLI and interactive review
- `twitter-api-v2` / `snoowrap` / `googleapis` / `discord.js` — Platform clients
- `gray-matter` — Markdown frontmatter parsing
- `zod` — Environment and config validation
