import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { getEnv } from "./env.js";
import { withRetry } from "./retry.js";

let client: Client | null = null;
let ready = false;

async function getDiscordClient(): Promise<Client> {
  if (!client) {
    const env = getEnv();
    if (!env.DISCORD_BOT_TOKEN) {
      throw new Error("Discord not configured. Set DISCORD_BOT_TOKEN in .env");
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.once("ready", () => {
      ready = true;
    });

    await client.login(env.DISCORD_BOT_TOKEN);

    // Wait for ready
    if (!ready) {
      await new Promise<void>((resolve) => {
        client!.once("ready", () => resolve());
      });
    }
  }
  return client;
}

export async function sendAnnouncement(message: string): Promise<{ id: string; url: string }> {
  const env = getEnv();
  const bot = await getDiscordClient();

  const channelId = env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    throw new Error("DISCORD_ANNOUNCEMENT_CHANNEL_ID not set in .env");
  }

  const channel = await withRetry(
    () => bot.channels.fetch(channelId),
    { label: "Discord fetchChannel" },
  );
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`Channel ${channelId} not found or not a text channel`);
  }

  const sent = await withRetry(
    () => channel.send(message),
    { label: "Discord sendAnnouncement" },
  );

  return {
    id: sent.id,
    url: sent.url,
  };
}

export async function sendToChannel(channelId: string, message: string): Promise<{ id: string; url: string }> {
  const bot = await getDiscordClient();
  const channel = await withRetry(
    () => bot.channels.fetch(channelId),
    { label: "Discord fetchChannel" },
  );

  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`Channel ${channelId} not found or not a text channel`);
  }

  const sent = await withRetry(
    () => channel.send(message),
    { label: "Discord sendToChannel" },
  );
  return { id: sent.id, url: sent.url };
}

export async function destroyClient(): Promise<void> {
  if (client) {
    client.destroy();
    client = null;
    ready = false;
  }
}
