import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env.js";
import { withRetry } from "./retry.js";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  }
  return client;
}

export interface GenerateContentParams {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}

export async function generateContent(params: GenerateContentParams): Promise<string> {
  const env = getEnv();
  const response = await withRetry(
    () => getClaudeClient().messages.create({
      model: params.model ?? env.DEFAULT_MODEL,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userMessage }],
    }),
    { label: "Claude API" },
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  return textBlock.text;
}

export async function reviewContent(content: string, reviewPrompt: string): Promise<string> {
  return generateContent({
    systemPrompt: reviewPrompt,
    userMessage: `Review the following content and provide specific, actionable feedback:\n\n${content}`,
    maxTokens: 1024,
  });
}
