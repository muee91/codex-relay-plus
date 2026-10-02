import type { ThreadSummary } from "codex-relay/api-schema";

import { workspaceName } from "../../lib/workspace-name";

const collapsedProjectThreadCount = 5;

export type DrawerRow =
  | { id: "needs-attention"; kind: "needs-attention" }
  | { id: "pinned"; kind: "pinned" }
  | {
      id: string;
      kind: "project";
      projectKey: string;
      title: string;
      workspacePath?: string;
    }
  | {
      id: string;
      kind: "thread";
      projectKey: string;
      thread: ThreadSummary;
      workspaceTitle?: string;
    }
  | { id: string; kind: "more"; hiddenCount: number; projectKey: string };

type ThreadGroup = {
  title: string;
  threads: ThreadSummary[];
  workspacePath?: string;
};

export function buildDrawerRows(
  threads: ThreadSummary[],
  expandedProjects: Record<string, boolean>,
  activeThreadId: string | undefined,
  pinnedThreadIds: string[] = [],
  forceExpanded = false,
): DrawerRow[] {
  const uniqueThreads = threadsWithUniqueIds(threads);
  const attentionThreads = forceExpanded
    ? []
    : uniqueThreads.filter(
        (thread) => Boolean(thread.attention) && thread.attention?.kind !== "failed",
      );
  const attentionThreadIds = new Set(attentionThreads.map((thread) => thread.id));
  const threadsById = new Map(uniqueThreads.map((thread) => [thread.id, thread]));
  const pinnedThreads = forceExpanded
    ? []
    : pinnedThreadsForIds(pinnedThreadIds, threadsById).filter(
        (thread) => !attentionThreadIds.has(thread.id),
      );
  const pinnedThreadIdsSet = new Set(pinnedThreads.map((thread) => thread.id));
  const groups = new Map<string, ThreadGroup>();

  for (const thread of uniqueThreads) {
    if (
      !forceExpanded &&
      (attentionThreadIds.has(thread.id) || pinnedThreadIdsSet.has(thread.id))
    ) {
      continue;
    }
    const title = workspaceName(thread.cwd) ?? "codex-relay";
    const projectKey = thread.cwd ?? title;
    const group = groups.get(projectKey);
    if (group) {
      group.threads.push(thread);
    } else {
      groups.set(projectKey, { title, threads: [thread], workspacePath: thread.cwd });
    }
  }

  const rows: DrawerRow[] = [];
  if (attentionThreads.length > 0) {
    rows.push({ id: "needs-attention", kind: "needs-attention" });
    rows.push(
      ...attentionThreads.map((thread) =>
        threadRow(thread, projectKeyForThread(thread), workspaceName(thread.cwd) ?? "codex-relay"),
      ),
    );
  }

  if (pinnedThreads.length > 0) {
    rows.push({ id: "pinned", kind: "pinned" });
    rows.push(
      ...pinnedThreads.map((thread) =>
        threadRow(thread, projectKeyForThread(thread), workspaceName(thread.cwd) ?? "codex-relay"),
      ),
    );
  }

  for (const [projectKey, group] of groups) {
    const unpinnedThreads = group.threads;
    if (unpinnedThreads.length === 0) {
      continue;
    }
    const isExpanded = forceExpanded || (expandedProjects[projectKey] ?? false);
    const activeThread = activeThreadId
      ? unpinnedThreads.find((thread) => thread.id === activeThreadId)
      : undefined;
    const collapsedThreads = unpinnedThreads.slice(0, collapsedProjectThreadCount);
    const visibleThreads =
      isExpanded || !activeThread || collapsedThreads.includes(activeThread)
        ? isExpanded
          ? unpinnedThreads
          : collapsedThreads
        : [...collapsedThreads.slice(0, collapsedProjectThreadCount - 1), activeThread];
    const hiddenCount = unpinnedThreads.length - visibleThreads.length;

    rows.push({
      id: `project:${projectKey}`,
      kind: "project",
      projectKey,
      title: group.title,
      workspacePath: group.workspacePath,
    });
    rows.push(...visibleThreads.map((thread) => threadRow(thread, projectKey)));

    if (hiddenCount > 0) {
      rows.push({
        id: `more:${projectKey}`,
        kind: "more",
        hiddenCount,
        projectKey,
      });
    }
  }

  return rows;
}

function threadsWithUniqueIds(threads: ThreadSummary[]) {
  const threadIds = new Set<string>();
  return threads.filter((thread) => {
    if (threadIds.has(thread.id)) {
      return false;
    }
    threadIds.add(thread.id);
    return true;
  });
}

function pinnedThreadsForIds(pinnedThreadIds: string[], threadsById: Map<string, ThreadSummary>) {
  const pinnedIds = new Set<string>();
  const pinnedThreads: ThreadSummary[] = [];
  for (const threadId of pinnedThreadIds) {
    if (pinnedIds.has(threadId)) {
      continue;
    }
    pinnedIds.add(threadId);
    const thread = threadsById.get(threadId);
    if (thread) {
      pinnedThreads.push(thread);
    }
  }
  return pinnedThreads;
}

function projectKeyForThread(thread: ThreadSummary) {
  const title = workspaceName(thread.cwd) ?? "codex-relay";
  return thread.cwd ?? title;
}

function threadRow(thread: ThreadSummary, projectKey: string, workspaceTitle?: string): DrawerRow {
  return {
    id: `thread:${thread.id}`,
    kind: "thread",
    projectKey,
    thread,
    ...(workspaceTitle ? { workspaceTitle } : {}),
  };
}
