import { describe, expect, it } from "vitest";

import { bindThreadQuery } from "../../../apps/mobile/src/lib/thread-query-fns.js";

describe("mobile thread query bindings", () => {
  it("passes the active thread id directly to each query function", async () => {
    const requestedThreadIds: string[] = [];
    const query = bindThreadQuery(async (threadId: string) => {
      requestedThreadIds.push(threadId);
      return threadId;
    }, "thread-real");

    await expect(query()).resolves.toBe("thread-real");
    expect(requestedThreadIds).toEqual(["thread-real"]);
  });
});
