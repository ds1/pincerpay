# Changelog

## v0.1.0 — 2026-02-20

Initial release of PincerPay marketing automation system.

### Added

**CLI Tool** (`pincer`)
- `generate` — Generate content from calendar or ad-hoc topics using Claude Sonnet 4.6
- `review` — Interactive TUI for approving, editing, rejecting, regenerating, or AI-reviewing drafts
- `publish` — Publish approved content to Twitter, Reddit, YouTube, Discord (with dry-run and confirmation)
- `status` — Pipeline dashboard showing draft/approved/published counts, overdue items, API status
- `calendar` — View the 8-week content calendar with optional generation status overlay
- `analytics` — Pull metrics from platform APIs for published content
- `report` — KPI report comparing actuals vs targets (stub)

**Content Generation Engine**
- Claude API integration via `@anthropic-ai/sdk` (default model: `claude-sonnet-4-6`)
- Composed system prompts: base prompt + brand voice guide (4,500 words) + channel-specific rules + content template
- 6 channel prompts: Twitter (punchy/opinionated), Reddit (value-first/anti-promo), YouTube (educational), Discord (warm/peer-to-peer), Blog (substantive/teach-or-argue), Review (AI critique)
- 6 content templates defining output structure per type (tweet, thread, reddit-post, youtube-description, discord-announcement, blog-post)

**File-Based Content Pipeline**
- Markdown files with YAML frontmatter in `content/{drafts,approved,published,rejected}/`
- Content store with CRUD operations, status transitions, and filtering
- Automatic filename generation: `{YYYY-MM-DD}-{channel}-{slug}.md`

**Platform API Clients**
- Twitter: tweet and thread posting, metrics via `twitter-api-v2`
- Reddit: self-post submission, metrics via `snoowrap`
- YouTube: video description management, metrics via `googleapis`
- Discord: announcement posting via `discord.js`

**Discord Bot** (`npm run discord-bot`)
- Welcome new members with onboarding message
- Auto-respond to support questions using Claude (rate-limited: 1 response per 30s per channel)
- Slash commands: `/announce`, `/showcase`
- Graceful shutdown on SIGINT/SIGTERM

**Configuration**
- Brand voice guide imported from pincerpay marketing plan
- Product context with verified facts, numbers, and competitive positioning
- 8-week content calendar (Weeks 9–16) with 40+ content pieces across all channels
- Channel configs (handles, subreddits, rate limits, frequencies)
- KPI targets per channel per month (March–May 2026)

**Infrastructure**
- TypeScript strict mode, ESM modules, run via `tsx`
- Zod-validated environment variables with per-platform optional configs
- Private GitHub repo: https://github.com/ds1/pincerpay-marketing-automation
- `.gitignore` covers `.env`, secrets, credentials, and tokens
