import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readLatestContextWindowUsage } from "../src/context-window.js";

describe("readLatestContextWindowUsage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores malformed numeric strings instead of accepting their numeric prefix", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "codex-relay-context-window-"));
    const sessionsDir = join(codexHome, "sessions", "2026", "09", "29");
    const threadId = "thread-malformed-token-count";
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(
      join(sessionsDir, `rollout-2026-09-29T00-00-00-${threadId}.jsonl`),
      JSON.stringify({
        payload: {
          info: {
            last_token_usage: { total_tokens: "42 tokens" },
            model_context_window: "128000 tokens",
          },
          type: "token_count",
        },
        type: "event_msg",
      }),
    );
    vi.stubEnv("CODEX_HOME", codexHome);

    expect(readLatestContextWindowUsage({ threadId })).toMatchObject({ usage: null });
  });
});
