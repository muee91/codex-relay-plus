import type { ChatMessage } from "codex-relay/api-schema";

export type ActivityStatusKind = "attention" | "completed" | "failed" | "streaming";

export type ActivityStatus = {
  accessibilityLabel: string;
  kind: ActivityStatusKind;
  label: string;
};

export function activityStatusForMessage(
  message: Pick<ChatMessage, "state">,
  needsUserAction = false,
): ActivityStatus {
  if (needsUserAction) {
    return {
      accessibilityLabel: "action required",
      kind: "attention",
      label: "Action required",
    };
  }

  switch (message.state) {
    case "streaming":
      return {
        accessibilityLabel: "in progress",
        kind: "streaming",
        label: "In progress",
      };
    case "failed":
      return {
        accessibilityLabel: "failed",
        kind: "failed",
        label: "Failed",
      };
    case "completed":
    default:
      // Historical protocol messages may not have a state. They are not live
      // work, so present them as completed instead of implying they are still running.
      return {
        accessibilityLabel: "completed",
        kind: "completed",
        label: "Completed",
      };
  }
}
