# Discord Server Setup Guide

## 1. Create the Server

1. Go to https://discord.com and click "+" to create a server
2. Choose "Create My Own" → "For a club or community"
3. Name: **PincerPay**
4. Upload the PincerPay logo as the server icon

## 2. Create Channels

### Categories & Channels

**WELCOME**
- `#welcome` — Read-only. Server rules and getting started info.
- `#introductions` — New members introduce themselves.

**GENERAL**
- `#announcements` — Read-only (bot/admin posts). Release notes, features, events.
- `#general` — Open discussion about PincerPay, agent payments, x402.
- `#off-topic` — Non-PincerPay conversation.

**SUPPORT**
- `#support` — Technical help. Bot auto-responds to questions.
- `#bugs` — Bug reports.
- `#feature-requests` — Feature requests and ideas.

**BUILD**
- `#showcase` — Community projects using PincerPay.
- `#code-help` — Code snippets, integration questions.
- `#feedback` — Product feedback, UX suggestions.

**COMMUNITY**
- `#contributors` — Gated to contributor role. OSS discussion.

## 3. Create Roles

| Role | Color | Permissions |
|------|-------|-------------|
| **Admin** | Red | Full permissions |
| **Team** | Orange (#F97316) | Manage messages, manage channels |
| **Contributor** | Purple | Access to #contributors |
| **Member** | Default | Send messages, read history |

## 4. Set Up the Bot

### Create Bot Application

1. Go to https://discord.com/developers/applications
2. Click "New Application" → name it "PincerPay Bot"
3. Go to "Bot" tab
4. Click "Reset Token" → copy the token → save to `.env` as `DISCORD_BOT_TOKEN`
5. Enable these Privileged Gateway Intents:
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### Generate Invite Link

1. Go to "OAuth2" → "URL Generator"
2. Scopes: `bot`, `applications.commands`
3. Bot Permissions:
   - Send Messages
   - Send Messages in Threads
   - Manage Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
   - Use Slash Commands
4. Copy the URL → open it → select your PincerPay server → Authorize

### Configure Environment

After inviting the bot:

1. Right-click the server name → "Copy Server ID" → save as `DISCORD_GUILD_ID`
2. Right-click #announcements → "Copy Channel ID" → save as `DISCORD_ANNOUNCEMENT_CHANNEL_ID`
3. Right-click #support → "Copy Channel ID" → save as `DISCORD_SUPPORT_CHANNEL_ID`

Add all to `.env`:
```
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_GUILD_ID=your-server-id
DISCORD_ANNOUNCEMENT_CHANNEL_ID=announcements-channel-id
DISCORD_SUPPORT_CHANNEL_ID=support-channel-id
```

### Start the Bot

```bash
npm run discord-bot
```

## 5. Welcome Message for #welcome

Post this in #welcome (or set as the server description):

```
**Welcome to PincerPay** — the payment gateway for the agentic economy.

PincerPay lets AI agents pay for APIs instantly using USDC on Solana via the x402 protocol.

**Quick Links**
→ Docs: https://pincerpay.com/docs
→ Demo: https://demo.pincerpay.com
→ GitHub: https://github.com/ds1/pincerpay

**Channels**
• #announcements — releases, features, events
• #support — ask anything, we respond fast
• #showcase — share what you're building
• #feedback — tell us what you think

**Rules**
1. Be helpful. We're all builders here.
2. No spam or self-promotion (unless in #showcase).
3. Search before asking — the answer might already be in docs.
4. Be specific in #support — include code, errors, and what you expected.
```

## 6. Bot Slash Commands

After the bot starts, these commands are available:

- `/announce <message>` — Post an announcement to #announcements
- `/showcase <project> <description> [link]` — Share a community project

## 7. Bot Behavior

- **Welcome messages**: When a new member joins, the bot sends a welcome message in #general
- **Support auto-respond**: Questions in #support get AI-powered responses (rate-limited to 1 per 30 seconds)
- **Announcements**: Use the CLI `pincer publish --channel discord` to post approved content, or use `/announce` in Discord
