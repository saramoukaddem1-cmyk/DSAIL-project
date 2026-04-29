export type ChatTurn = { role: string; content: string };

const MAX_TRANSCRIPT_CHARS = 12_000;

/**
 * Build a single string of recent dialogue for models + heuristics.
 */
export function buildChatTranscript(
  messages: ChatTurn[],
  opts: { maxChars?: number } = {},
): string {
  const max = opts.maxChars ?? MAX_TRANSCRIPT_CHARS;
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const role = m.role === "user" ? "User" : "Assistant";
    const c = m.content.trim();
    if (!c) continue;
    lines.push(`${role}: ${c}`);
  }
  let joined = lines.join("\n");
  if (joined.length > max) {
    joined = joined.slice(joined.length - max);
  }
  return joined;
}

export function lastUserMessage(messages: ChatTurn[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content.trim();
  }
  return "";
}

/** Last assistant text (for continuity, not used for search). */
export function lastAssistantMessage(messages: ChatTurn[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "assistant") return messages[i]!.content.trim();
  }
  return "";
}
