# PincerPay Marketing Automation

Local CLI-based marketing automation system for PincerPay. Generates, reviews, and publishes content across X/Twitter, Reddit, YouTube, Discord, and blog.

## Commands

```bash
npm run cli -- <command>         # Run any CLI command
npm run generate                 # Generate content for current week
npm run review                   # Interactive content review
npm run cli -- publish           # Publish approved content
npm run cli -- status            # Pipeline overview
npm run cli -- calendar          # View content calendar
npm run cli -- analytics pull    # Pull platform metrics
npm run cli -- report            # KPI report
npm run discord-bot              # Start Discord bot (long-running)
npm run typecheck                # TypeScript check
npm run test                     # Run tests
```

## Architecture

- **File-based content queue**: `content/{drafts,approved,published,rejected}/` — markdown files with YAML frontmatter
- **Claude API for generation**: Anthropic SDK with brand voice + channel prompts composed as system prompts
- **Human review required**: All content must be approved via CLI before publishing
- **Platform APIs**: twitter-api-v2, snoowrap, googleapis, discord.js

## Key Directories

- `config/` — Brand voice guide, content calendar, channel configs, KPI targets
- `prompts/` — System prompts and channel-specific generation prompts
- `content/` — Content pipeline (drafts → approved → published)
- `src/lib/` — Core utilities (Claude client, content store, platform clients)
- `src/agents/` — Standalone agent scripts (generate, publish, analytics, discord-bot)
- `src/cli/` — Commander.js CLI with interactive review TUI

## Conventions

- TypeScript strict mode, ESM modules, run via tsx
- Content files: `{YYYY-MM-DD}-{channel}-{slug}.md` with YAML frontmatter
- All content generation uses brand voice guide from `config/brand-voice.md`
- Platform API keys in `.env` (never committed)

## Related Projects

- Main PincerPay repo: `C:\Users\danma\Documents\GitHub\pincerpay`
- Agent demo: `C:\Users\danma\Documents\GitHub\pincerpay-agent-demo`
- Brand voice & marketing plan: `pincerpay@claude/pincerpay-marketing-plan-n3mrf:_planning/`

See STATUS.md for current work.
