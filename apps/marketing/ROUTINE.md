Dan's Content Workflow Guide

  Weekly: Generate content

  npm run generate -- --week week-1

  This pulls all entries from the content calendar for that week, sends each to Claude with brand voice +
  channel-specific prompts, and writes drafts to content/drafts/.

  You can also generate for a single channel or ad-hoc topic:

  npm run generate -- --week week-2 --channel twitter
  npm run generate -- --topic "Hot take on OpenAI's new protocol" --channel twitter

  Review every draft

  npm run review

  Interactive TUI walks you through each draft. For each one you can:

  - Approve — moves to content/approved/
  - Edit — opens in your editor, save and close to continue
  - Reject — asks for a reason, moves to content/rejected/
  - Regenerate — give Claude feedback, it rewrites the draft
  - AI Review — Claude critiques the draft against brand voice before you decide
  - Skip — come back to it later

  Publish approved content

  npm run publish                    # publish everything approved
  npm run publish -- --channel twitter   # just twitter
  npm run publish -- --scheduled     # only items past their scheduled date
  npm run publish -- --dry-run       # preview without posting

  What happens per channel:
  - Twitter — posts tweet or thread via API
  - Reddit — submits self-post to the target subreddit
  - Discord — sends announcement to your server
  - Blog — writes the markdown file to the pincerpay repo (you still need to git commit && git push in that
  repo to deploy)
  - YouTube — marks as done (video upload is manual, this generates the description)

  Check pipeline status

  npm run status

  Shows counts per status (drafts, approved, published, rejected), overdue items, and which platform APIs are
  configured.

  View calendar

  npm run calendar -- --week week-1
  npm run calendar -- --month 2026-03 --status

  Shows what's planned and overlays generation/publish status.

  Typical daily routine

  1. npm run status — see where things stand
  2. npm run generate — generate anything due this week that hasn't been drafted yet
  3. npm run review — approve, edit, or reject drafts
  4. npm run publish -- --scheduled — publish anything approved and past its scheduled date