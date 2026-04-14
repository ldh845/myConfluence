import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const claude = new Anthropic({
  apiKey: apiKey ?? "",
});

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export function isClaudeConfigured() {
  return !!apiKey && apiKey.length > 10;
}
