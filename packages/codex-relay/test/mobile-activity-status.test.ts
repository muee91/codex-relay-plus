import { describe, expect, it } from "vitest";

import { activityStatusForMessage } from "../../../apps/mobile/src/components/chat/activity-status.js";

describe("mobile protocol activity status", () => {
  it("shows active work only for streaming messages", () => {
    expect(activityStatusForMessage({ state: "streaming" })).toMatchObject({
      kind: "streaming",
      label: "In progress",
    });
    expect(activityStatusForMessage({ state: "completed" })).toMatchObject({
      kind: "completed",
      label: "Completed",
    });
  });

  it("treats failed and historical messages as terminal", () => {
    expect(activityStatusForMessage({ state: "failed" })).toMatchObject({
      kind: "failed",
      label: "Failed",
    });
    expect(activityStatusForMessage({})).toMatchObject({
      kind: "completed",
      label: "Completed",
    });
  });

  it("prioritizes a pending user action over the message lifecycle state", () => {
    expect(activityStatusForMessage({ state: "completed" }, true)).toMatchObject({
      kind: "attention",
      label: "Action required",
    });
  });
});
