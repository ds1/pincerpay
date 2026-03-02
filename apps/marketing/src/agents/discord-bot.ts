#!/usr/bin/env tsx
/**
 * PincerPay Discord Community Bot
 *
 * Long-running process that manages the developer Discord server.
 * Start with: npm run discord-bot
 *
 * Features:
 * - Welcome new members with onboarding message
 * - Respond to support questions in #support using Claude
 * - Post announcements from approved content queue
 * - Slash commands: /announce, /showcase
 * - Rate-limited Claude API calls (max 1 response per 30s per channel)
 */
import {
  Client,
  GatewayIntentBits,
  Events,
  TextChannel,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
  type Interaction,
  type Message,
  type GuildMember,
} from "discord.js";
import { generateContent } from "../lib/claude.js";
import { loadBrandVoice, loadProductContext } from "../lib/config.js";
import { loadPrompt } from "../lib/prompt-loader.js";
import { getEnv } from "../lib/env.js";
import { log } from "../lib/logger.js";

// Rate limiting: track last response time per channel
const lastResponseTime = new Map<string, number>();
const RATE_LIMIT_MS = 30_000; // 30 seconds between AI responses per channel

const env = getEnv();

if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) {
  log.error("DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Ready ──────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  log.success(`Discord bot online as ${c.user.tag}`);
  log.info(`Serving guild: ${env.DISCORD_GUILD_ID}`);
  log.info(`Support channel: ${env.DISCORD_SUPPORT_CHANNEL_ID ?? "not configured"}`);
  log.info(`Announcement channel: ${env.DISCORD_ANNOUNCEMENT_CHANNEL_ID ?? "not configured"}`);
});

// ── New Member Welcome ─────────────────────────────────────────────────

client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  log.info(`New member joined: ${member.user.tag}`);

  // Send welcome in the system channel or first text channel
  const guild = member.guild;
  const welcomeChannel =
    guild.systemChannel ??
    guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name.includes("general")
    );

  if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
    const message = [
      `Welcome ${member.user}! 👋`,
      "",
      "Here's how to get started with PincerPay:",
      "",
      "• **#support** — ask anything, we respond fast",
      "• **#showcase** — share what you're building",
      "• **Docs** — https://pincerpay.com/docs",
      "• **Demo** — https://demo.pincerpay.com",
      "",
      "What are you building?",
    ].join("\n");

    await (welcomeChannel as TextChannel).send(message);
  }
});

// ── Support Channel Auto-Respond ───────────────────────────────────────

client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only respond in the support channel
  if (!env.DISCORD_SUPPORT_CHANNEL_ID) return;
  if (message.channelId !== env.DISCORD_SUPPORT_CHANNEL_ID) return;

  // Rate limit check
  const lastTime = lastResponseTime.get(message.channelId) ?? 0;
  if (Date.now() - lastTime < RATE_LIMIT_MS) {
    return; // Skip — responded too recently
  }

  // Only respond to messages that look like questions
  const content = message.content.trim();
  if (!looksLikeQuestion(content)) return;

  try {
    log.info(`Support question from ${message.author.tag}: "${content.slice(0, 80)}..."`);

    // Show typing indicator
    if ("sendTyping" in message.channel) {
      await message.channel.sendTyping();
    }

    const response = await generateSupportResponse(content, message.author.displayName);

    // Truncate to Discord's 2000 char limit
    const trimmed = response.length > 1900
      ? response.slice(0, 1900) + "\n\n*[Response truncated — ask a follow-up for more detail]*"
      : response;

    await message.reply(trimmed);
    lastResponseTime.set(message.channelId, Date.now());

    log.success(`Responded to ${message.author.tag}`);
  } catch (error) {
    log.error(`Failed to respond: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// ── Slash Commands ─────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "announce") {
    await handleAnnounce(interaction);
  } else if (interaction.commandName === "showcase") {
    await handleShowcase(interaction);
  }
});

async function handleAnnounce(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const message = interaction.options.getString("message", true);
  const channelId = env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;

  if (!channelId) {
    await interaction.reply({ content: "Announcement channel not configured.", ephemeral: true });
    return;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    await interaction.reply({ content: "Announcement channel not found.", ephemeral: true });
    return;
  }

  await channel.send(message);
  await interaction.reply({ content: "Announcement posted.", ephemeral: true });
  log.success(`Announcement posted by ${interaction.user.tag}`);
}

async function handleShowcase(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const project = interaction.options.getString("project", true);
  const description = interaction.options.getString("description", true);
  const link = interaction.options.getString("link");

  const showcaseMessage = [
    `🔧 **Community Showcase**`,
    "",
    `**${project}** by ${interaction.user}`,
    description,
    link ? `\n→ ${link}` : "",
  ].join("\n");

  await interaction.reply(showcaseMessage);
  log.success(`Showcase posted by ${interaction.user.tag}: ${project}`);
}

// ── Helpers ────────────────────────────────────────────────────────────

function looksLikeQuestion(text: string): boolean {
  if (text.length < 10) return false;
  if (text.endsWith("?")) return true;
  const questionWords = ["how", "what", "why", "where", "when", "can", "does", "is", "help", "error", "issue", "problem", "bug", "fail"];
  const lower = text.toLowerCase();
  return questionWords.some((w) => lower.startsWith(w) || lower.includes(` ${w} `));
}

async function generateSupportResponse(question: string, username: string): Promise<string> {
  const brandVoice = loadBrandVoice();
  const productContext = loadProductContext();
  let discordPrompt = "";
  try {
    discordPrompt = loadPrompt("discord.md");
  } catch {
    // Prompt file optional
  }

  const systemPrompt = [
    "You are a PincerPay developer support assistant in a Discord server.",
    "Answer technical questions about PincerPay accurately and helpfully.",
    "Use the Discord voice: warm, peer-to-peer, use first names.",
    "Keep responses concise (under 300 words). Include code snippets when relevant.",
    "If you don't know the answer, say so honestly and point to docs.",
    "Never make up features or capabilities that don't exist.",
    "",
    "# Product Context",
    productContext,
    "",
    "# Discord Voice Rules",
    discordPrompt,
    "",
    "# Brand Voice (abbreviated)",
    "Technical precision. Show don't tell. Honest scope. Respect reader's time. Protocol not platform.",
  ].join("\n");

  return generateContent({
    systemPrompt,
    userMessage: `${username} asks in #support:\n\n${question}`,
    maxTokens: 800,
  });
}

// ── Register Slash Commands ────────────────────────────────────────────

async function registerCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName("announce")
      .setDescription("Post an announcement to the announcements channel")
      .addStringOption((opt) =>
        opt.setName("message").setDescription("The announcement text").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("showcase")
      .setDescription("Share a community project in the showcase")
      .addStringOption((opt) =>
        opt.setName("project").setDescription("Project name").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("Brief description").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("link").setDescription("Link to project (optional)").setRequired(false)
      ),
  ];

  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN!);

  log.info("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(client.user!.id, env.DISCORD_GUILD_ID!), {
    body: commands.map((c) => c.toJSON()),
  });
  log.success("Slash commands registered.");
}

// ── Startup ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.header("PincerPay Discord Bot");

  await client.login(env.DISCORD_BOT_TOKEN);

  // Wait for ready before registering commands
  if (!client.isReady()) {
    await new Promise<void>((resolve) => {
      client.once(Events.ClientReady, () => resolve());
    });
  }

  await registerCommands();

  log.info("Bot is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down...");
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
