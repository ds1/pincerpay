import fs from "node:fs";
import path from "node:path";
import { getPromptsDir, getConfigPath } from "./config.js";
import type { Channel, ContentType } from "../types/index.js";

function loadFile(filepath: string): string {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`);
  }
  return fs.readFileSync(filepath, "utf-8");
}

export function loadPrompt(name: string): string {
  return loadFile(path.join(getPromptsDir(), name));
}

export function loadTemplate(type: ContentType): string {
  const filepath = path.join(getConfigPath("templates"), `${type}.md`);
  if (!fs.existsSync(filepath)) {
    return ""; // Templates are optional
  }
  return fs.readFileSync(filepath, "utf-8");
}

export function composeSystemPrompt(channel: Channel, type: ContentType): string {
  const parts: string[] = [];

  // Base system prompt
  parts.push(loadPrompt("system.md"));

  // Brand voice guide
  const brandVoice = loadFile(getConfigPath("brand-voice.md"));
  parts.push("# Brand Voice Guide\n\n" + brandVoice);

  // Product context
  const productContextPath = getConfigPath("product-context.md");
  if (fs.existsSync(productContextPath)) {
    parts.push(loadFile(productContextPath));
  }

  // Channel-specific prompt
  const channelPromptPath = path.join(getPromptsDir(), `${channel}.md`);
  if (fs.existsSync(channelPromptPath)) {
    parts.push(loadFile(channelPromptPath));
  }

  // Content type template
  const template = loadTemplate(type);
  if (template) {
    parts.push("# Output Template\n\nFollow this template structure:\n\n" + template);
  }

  return parts.join("\n\n---\n\n");
}

export function loadReviewPrompt(): string {
  return loadPrompt("review.md");
}
