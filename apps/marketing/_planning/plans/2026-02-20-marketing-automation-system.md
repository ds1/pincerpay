# PincerPay Marketing Automation — Implementation Plan

**Date:** 2026-02-20
**Objective:** Build a local CLI-based marketing automation system that uses Claude API to generate, review, and publish content across X/Twitter, Reddit, YouTube, Discord, and Blog — with human approval on everything.

---

## Context

PincerPay has comprehensive marketing strategy docs (brand voice guide, 3-month content calendar, distribution plan) but zero social presence and no automation. Other Claude instances handle product engineering, SEO, and end-user docs. This system fills the gap: content generation, approval workflows, multi-channel publishing, and analytics tracking — all run locally as CLI tools, no deployment needed.

**Source materials to import into this project:**
- Brand Voice Guide (4,500 words) from `pincerpay@claude/pincerpay-marketing-plan-n3mrf:_planning/brand-voice-guide.md`
- Marketing Plan's 3-month content calendar from same branch
- Distribution Strategy from `pincerpay@claude/distribution-research-lZE3O:_planning/research/distribution-strategy.md`

---

## Architecture

```
Local CLI System (no server, no database, no deployment)

User runs CLI commands → Claude API generates content → File-based queue → Human reviews → Platform APIs publish

                  ┌─────────────┐
                  │  Content     │
                  │  Calendar    │
                  │  (YAML)      │
                  └──────┬──────┘
                         │
                         v
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Claude   │────>│   content/   │────>│  Human   │────>│  Platform    │
│  API      │     │   drafts/    │     │  Review  │     │  APIs        │
│ (generate)│     │              │     │  (CLI)   │     │ (publish)    │
└──────────┘     └──────────────┘     └────┬─────┘     └──────────────┘
                                           │
                                    ┌──────┴──────┐
                                    │             │
                                    v             v
                              approved/      rejected/
                                    │
                                    v
                              published/
```

---

## Tech Stack

- **Runtime:** Node.js + TypeScript, run via `tsx`
- **AI:** `@anthropic-ai/sdk` (Claude Sonnet for generation, configurable)
- **CLI:** `commander` + `inquirer` for interactive review
- **Platforms:** `twitter-api-v2`, `snoowrap`, `googleapis`, `discord.js`
- **Utils:** `gray-matter` (frontmatter), `zod` (validation), `chalk` (output), `dayjs` (dates), `dotenv`
- **Testing:** `vitest`

---

## Project Structure

```
pincerpay-marketing-automation/
├── package.json / tsconfig.json / .env.example / .gitignore / .gitattributes
├── CLAUDE.md / STATUS.md / CHANGELOG.md / README.md
│
├── config/
│   ├── brand-voice.md            # Copied from pincerpay repo
│   ├── product-context.md        # Key product facts for prompt injection
│   ├── content-calendar.yaml     # 3-month week-by-week plan
│   ├── channels.yaml             # Per-channel config (handles, subreddits, rate limits)
│   ├── kpis.yaml                 # Monthly targets per channel
│   └── templates/                # Output templates per content type
│       ├── tweet.md / thread.md / reddit-post.md
│       ├── youtube-description.md / discord-announcement.md / blog-post.md
│
├── prompts/
│   ├── system.md                 # Base system prompt (role + product knowledge)
│   ├── twitter.md                # X-specific tone, constraints, patterns
│   ├── reddit.md                 # Reddit-specific rules (anti-promo, value-first)
│   ├── youtube.md / discord.md / blog.md
│   └── review.md                 # AI-assisted review suggestions prompt
│
├── content/                      # File-based content queue
│   ├── drafts/                   # Generated, awaiting review
│   ├── approved/                 # Reviewed, ready to publish
│   ├── published/                # Published with platform IDs
│   └── rejected/                 # Rejected with feedback
│
├── src/
│   ├── types/
│   │   └── index.ts              # All types: Channel, ContentPiece, ContentStatus, etc.
│   ├── lib/
│   │   ├── env.ts                # Zod-validated env loading
│   │   ├── config.ts             # YAML/MD config loader
│   │   ├── claude.ts             # Anthropic SDK wrapper
│   │   ├── content-store.ts      # File-based CRUD (list/read/write/move)
│   │   ├── prompt-loader.ts      # Compose system prompts from files
│   │   ├── calendar.ts           # Parse calendar, find due content
│   │   ├── twitter.ts            # Twitter API v2 client
│   │   ├── reddit.ts             # Reddit/snoowrap client
│   │   ├── youtube.ts            # YouTube Data API client
│   │   ├── discord.ts            # Discord.js wrapper
│   │   └── logger.ts             # Chalk-based structured logging
│   ├── agents/
│   │   ├── generate.ts           # Content generation agent
│   │   ├── publish.ts            # Publishing agent
│   │   ├── analytics.ts          # Metrics collection agent
│   │   └── discord-bot.ts        # Long-running Discord community bot
│   └── cli/
│       ├── index.ts              # Commander.js program entry
│       ├── commands/
│       │   ├── generate.ts       # `pincer generate [--channel] [--week] [--topic] [--dry-run]`
│       │   ├── review.ts         # `pincer review [--channel] [--id]`
│       │   ├── publish.ts        # `pincer publish [--channel] [--dry-run] [--yes]`
│       │   ├── calendar.ts       # `pincer calendar [--week] [--month] [--status]`
│       │   ├── analytics.ts      # `pincer analytics pull [--channel] [--days]`
│       │   ├── report.ts         # `pincer report [--month] [--channel]`
│       │   └── status.ts         # `pincer status` (pipeline overview)
│       └── ui/
│           ├── reviewer.ts       # Interactive review TUI (inquirer)
│           └── formatters.ts     # Tables, badges, content previews
│
├── scripts/
│   ├── setup-youtube-oauth.ts    # One-time YouTube OAuth2 flow
│   └── validate-config.ts       # Validate all configs against schemas
│
└── _planning/
    ├── backlog.md / sprint.md
    └── plans/
```

---

## Content File Format

Every content piece is a markdown file: `{YYYY-MM-DD}-{channel}-{slug}.md`

```yaml
---
id: "2026-02-21-twitter-x402-cost-comparison"
title: "x402 Cost Comparison Thread"
channel: "twitter"          # twitter | reddit | youtube | discord | blog
type: "thread"              # tweet | thread | reddit-post | youtube-desc | announcement | blog-post
status: "draft"             # draft | approved | published | rejected
created_at: "2026-02-20T10:00:00Z"
updated_at: "2026-02-20T10:00:00Z"
scheduled_for: "2026-02-21T14:00:00Z"
published_at: null
platform_id: null
platform_url: null
calendar_week: "2026-W08"
topic_brief: "Compare x402 costs vs Stripe for sub-$1 transactions"
tags: ["cost-comparison", "x402"]
generation_model: "claude-sonnet-4-20250514"
review_notes: ""
rejection_reason: ""
metrics:
  impressions: null
  engagement: null
  clicks: null
  pulled_at: null
---

## Tweet 1/4
Stripe charges $0.30 + 2.9% per transaction.
...
```

---

## CLI Workflow

```bash
# Daily workflow:
pincer generate                     # Generate all content due this week
pincer review                       # Interactive review queue
pincer publish --scheduled          # Publish approved items due today
pincer status                       # Pipeline overview

# Ad-hoc:
pincer generate --topic "Hot take on OpenAI's new ACP protocol"
pincer generate --channel twitter --week 2026-W09
pincer review --channel reddit
pincer publish --channel twitter --dry-run
pincer analytics pull
pincer report --month 2026-02
pincer calendar --status
```

### Interactive Review Flow
1. Display content with formatting (channel badge, char count, scheduled date)
2. Options: **Approve** | **Edit** (opens $EDITOR) | **Reject** (with reason) | **Regenerate** (with feedback to Claude) | **AI Review** (Claude critiques it) | **Skip**
3. Approved content moves to `content/approved/`, rejected to `content/rejected/`

---

## Build Phases

### Phase 1: Foundation (files 1-13)
- [ ] Project init: `package.json`, `tsconfig.json`, `.gitignore`, `.gitattributes`, `.env.example`
- [ ] Types: `src/types/index.ts` (Channel, ContentPiece, ContentStatus, ContentFile, etc.)
- [ ] Core lib: `env.ts`, `config.ts`, `content-store.ts`, `logger.ts`
- [ ] Config files: `channels.yaml`, `kpis.yaml`, `brand-voice.md` (copy from pincerpay repo)
- [ ] Project docs: `CLAUDE.md`, `STATUS.md`, `README.md`

### Phase 2: Content Generation (files 14-25)
- [ ] Claude client: `src/lib/claude.ts` (Anthropic SDK wrapper)
- [ ] Prompt system: `src/lib/prompt-loader.ts` + all prompt files (`prompts/system.md`, `twitter.md`, `reddit.md`, `youtube.md`, `discord.md`, `blog.md`)
- [ ] Content templates: `config/templates/*.md` (6 templates)
- [ ] Calendar: `src/lib/calendar.ts` + `config/content-calendar.yaml`
- [ ] Product context: `config/product-context.md`
- [ ] Generation agent: `src/agents/generate.ts`

### Phase 3: Review CLI (files 26-32)
- [ ] CLI framework: `src/cli/index.ts` (Commander.js entry)
- [ ] Commands: `generate.ts`, `review.ts`, `status.ts`, `calendar.ts`
- [ ] Review TUI: `src/cli/ui/reviewer.ts` (inquirer-based interactive review)
- [ ] Formatters: `src/cli/ui/formatters.ts`

### Phase 4: Publishing (files 33-40)
- [ ] Platform clients: `twitter.ts`, `reddit.ts`, `youtube.ts`, `discord.ts`
- [ ] Publishing agent: `src/agents/publish.ts`
- [ ] Publish command: `src/cli/commands/publish.ts`
- [ ] YouTube OAuth setup: `scripts/setup-youtube-oauth.ts`

### Phase 5: Analytics & Reporting (files 41-43)
- [ ] Analytics agent: `src/agents/analytics.ts`
- [ ] Analytics command: `src/cli/commands/analytics.ts`
- [ ] Report command: `src/cli/commands/report.ts`

### Phase 6: Discord Bot (file 44)
- [ ] Discord bot: `src/agents/discord-bot.ts` (long-running, welcome messages, support responses via Claude, slash commands)

### Phase 7: Polish
- [ ] Retry logic + rate limit tracking on all API calls
- [ ] Config validation script: `scripts/validate-config.ts`
- [ ] `--verbose` flag on all commands
- [ ] Comprehensive `README.md` with setup walkthrough

---

## Platform API Setup (Prerequisites)

| Platform | Library | Auth Type | Key Env Vars |
|----------|---------|-----------|-------------|
| Claude | `@anthropic-ai/sdk` | API Key | `ANTHROPIC_API_KEY` |
| X/Twitter | `twitter-api-v2` | OAuth 1.0a | `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` |
| Reddit | `snoowrap` | Script App | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` |
| YouTube | `googleapis` | OAuth 2.0 | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` |
| Discord | `discord.js` | Bot Token | `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` |

---

## Key Design Decisions

1. **File-based queue over database** — Human-readable, git-trackable, editable in any text editor, no schema migrations. ~50-100 files/month is well within filesystem performance.

2. **Claude Sonnet for generation** — Cost-efficient for 20-40 API calls/week. Configurable to Opus for high-stakes content (blog posts, conference materials).

3. **Separate agents over monolith** — `generate.ts`, `publish.ts`, `analytics.ts`, `discord-bot.ts` are independently runnable. Can be scheduled via Windows Task Scheduler. Each fails independently.

4. **Brand voice in every prompt** — The full brand voice guide is injected as part of the system prompt for every generation call. Channel-specific prompts layer additional constraints on top.

5. **No auto-publish path** — Every content piece must go through `content/drafts/` → human review → `content/approved/` → explicit publish command. No shortcuts.

---

## Verification

After each phase, test end-to-end:

1. **Phase 1:** Create a test markdown file in `content/drafts/`, read it with content-store, verify frontmatter parsing
2. **Phase 2:** `pincer generate --channel twitter --dry-run` → verify draft appears in `content/drafts/` with correct frontmatter and brand-voice-compliant body
3. **Phase 3:** `pincer review` → approve/reject/edit test content → verify files move to correct directories
4. **Phase 4:** `pincer publish --channel twitter --dry-run` → verify payload → publish for real → confirm on platform
5. **Phase 5:** `pincer analytics pull` → `pincer report` → verify metrics populated and KPI comparison works
6. **Phase 6:** `npm run discord-bot` → send test message in support channel → verify Claude-powered response

---

## Critical Files (in build priority order)

1. `src/types/index.ts` — Every file imports from here
2. `src/lib/content-store.ts` — Core file-based CRUD, the backbone of the pipeline
3. `src/lib/claude.ts` — Anthropic SDK wrapper for all content generation
4. `src/lib/prompt-loader.ts` — Composes brand voice + channel rules + templates into system prompts
5. `src/agents/generate.ts` — Content generation agent (ties calendar + prompts + Claude + store)
6. `src/cli/ui/reviewer.ts` — Interactive review TUI, the human-in-the-loop quality gate
7. `config/brand-voice.md` — Imported from pincerpay repo, injected into every generation call
