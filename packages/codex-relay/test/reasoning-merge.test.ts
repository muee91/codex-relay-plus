import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/api-schema.js";

import { mergeReasoningMessages } from "../src/app.js";

const timestamp = "2026-09-30T00:00:00.000Z";

describe("reasoning message merge", () => {
  it("updates an item in place and appends new items for the same turn", () => {
    const current = reasoningMessage("reasoning", [
      { content: ["first detail"], id: "item-a", summary: ["first step"] },
    ]);
    const incoming = reasoningMessage("reasoning-update", [
      { content: ["updated detail"], id: "item-a", summary: ["updated step"] },
      { content: ["second detail"], id: "item-b", summary: ["second step"] },
    ]);

    const merged = mergeReasoningMessages(current, incoming);

    expect(merged.details?.reasoningItems).toEqual([
      { content: ["updated detail"], id: "item-a", summary: ["updated step"] },
      { content: ["second detail"], id: "item-b", summary: ["second step"] },
    ]);
    expect(merged.content).toBe("updated step\n\nsecond step\n\nupdated detail\n\nsecond detail");
    expect(merged.id).toBe("reasoning");
  });
});

function reasoningMessage(
  id: string,
  reasoningItems: Array<{ content: string[]; id: string; summary: string[] }>,
): ChatMessage {
  return {
    content: "Reasoning",
    createdAt: timestamp,
    details: { reasoningItems },
    id,
    kind: "thinking",
    role: "reasoning",
    state: "streaming",
    threadId: "thread-1",
    turnId: "turn-1",
    updatedAt: timestamp,
  };
}
