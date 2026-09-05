import { useSelector } from "@legendapp/state/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Colors, Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { listArchivedThreads, restoreArchivedThread } from "@/lib/archived-threads-api";
import { hapticSelection, hapticWarning } from "@/lib/haptics";
import { setThreadsState } from "@/lib/server-state";
import { chatStore$, replaceThreads } from "@/state/chat-store";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
const copy = isZhCn
  ? {
      title: "已归档会话",
      subtitle: "恢复后会重新出现在会话列表中",
      emptyTitle: "暂无已归档会话",
      emptyBody: "你归档的会话会显示在这里。",
      loadError: "无法加载已归档会话",
      retry: "重试",
      restore: "恢复",
      restoring: "恢复中",
      restoreError: "恢复失败",
      back: "返回设置",
    }
  : {
      title: "Archived chats",
      subtitle: "Restored chats return to your normal chat list",
      emptyTitle: "No archived chats",
      emptyBody: "Chats you archive will appear here.",
      loadError: "Could not load archived chats",
      retry: "Retry",
      restore: "Restore",
      restoring: "Restoring",
      restoreError: "Restore failed",
      back: "Back to settings",
    };

export default function ArchivedChatsScreen() {
  const queryClient = useQueryClient();
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const serverUrl = useSelector(() => chatStore$.serverUrl.get());
  const [restoringThreadId, setRestoringThreadId] = useState<string | undefined>();
  const archivedQuery = useQuery({
    queryKey: ["codex-relay-archived-threads", serverUrl],
    queryFn: listArchivedThreads,
    enabled: hasPairedSession,
    staleTime: 0,
  });

  function close() {
    hapticSelection();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/settings");
  }

  async function restore(threadId: string) {
    if (restoringThreadId) {
      return;
    }

    hapticSelection();
    setRestoringThreadId(threadId);
    try {
      const response = await restoreArchivedThread(threadId);
      setThreadsState(queryClient, response.threads, response.source);
      replaceThreads(response.threads);
      archivedQuery.setData((current) =>
        current
          ? { ...current, threads: current.threads.filter((thread) => thread.id !== threadId) }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["codex-relay-server-state", serverUrl] });
    } catch (error) {
      hapticWarning();
      Alert.alert(
        copy.restoreError,
        error instanceof Error ? error.message : copy.restoreError,
      );
    } finally {
      setRestoringThreadId(undefined);
    }
  }

  const threads = archivedQuery.data?.threads ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={copy.back}
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Icon name="back" size={19} tintColor={Colors.dark.text} />
          </Pressable>
          <View style={styles.titleGroup}>
            <ThemedText type="smallBold" style={styles.title}>
              {copy.title}
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary" style={styles.subtitle}>
              {copy.subtitle}
            </ThemedText>
          </View>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={archivedQuery.isRefetching}
              onRefresh={() => void archivedQuery.refetch()}
              tintColor={Colors.dark.textSecondary}
            />
          }
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {!hasPairedSession ? (
            <EmptyState title={copy.loadError} body={copy.emptyBody} />
          ) : archivedQuery.isLoading ? (
            <EmptyState title={copy.title} body="…" />
          ) : archivedQuery.isError ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon name="warning" size={20} tintColor="#FFB4A8" />
              </View>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                {copy.loadError}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
                {archivedQuery.error instanceof Error
                  ? archivedQuery.error.message
                  : copy.loadError}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => void archivedQuery.refetch()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <ThemedText type="code" style={styles.retryButtonText}>
                  {copy.retry}
                </ThemedText>
              </Pressable>
            </View>
          ) : threads.length === 0 ? (
            <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
          ) : (
            <View style={styles.threadList}>
              {threads.map((thread) => {
                const restoring = restoringThreadId === thread.id;
                return (
                  <View key={thread.id} style={styles.threadRow}>
                    <View style={styles.threadIcon}>
                      <Icon name="archive" size={17} tintColor={Colors.dark.textSecondary} />
                    </View>
                    <View style={styles.threadCopy}>
                      <ThemedText type="smallBold" style={styles.threadTitle} numberOfLines={2}>
                        {thread.title || "Untitled chat"}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.threadPreview}
                        numberOfLines={2}
                      >
                        {thread.lastMessagePreview || projectLabel(thread.cwd)}
                      </ThemedText>
                      <ThemedText type="code" themeColor="textSecondary" style={styles.threadMeta}>
                        {[projectLabel(thread.cwd), relativeActivity(thread.lastActivityAt ?? thread.updatedAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </ThemedText>
                    </View>
                    <Pressable
                      accessibilityLabel={`${copy.restore}: ${thread.title || "chat"}`}
                      accessibilityRole="button"
                      disabled={Boolean(restoringThreadId)}
                      onPress={() => void restore(thread.id)}
                      style={({ pressed }) => [
                        styles.restoreButton,
                        restoringThreadId && styles.restoreButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={restoring ? "refresh" : "rewind"}
                        size={14}
                        tintColor="#93E1B6"
                      />
                      <ThemedText type="code" style={styles.restoreButtonText}>
                        {restoring ? copy.restoring : copy.restore}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Icon name="archive" size={20} tintColor={Colors.dark.textSecondary} />
      </View>
      <ThemedText type="smallBold" style={styles.emptyTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
        {body}
      </ThemedText>
    </View>
  );
}

function projectLabel(cwd: string | undefined) {
  const normalized = cwd?.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalized?.split("/").filter(Boolean).pop() ?? "";
}

function relativeActivity(value: string | undefined) {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) {
    return isZhCn ? "刚刚" : "just now";
  }
  if (elapsedMinutes < 60) {
    return isZhCn ? `${elapsedMinutes} 分钟前` : `${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return isZhCn ? `${elapsedHours} 小时前` : `${elapsedHours}h ago`;
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  return isZhCn ? `${elapsedDays} 天前` : `${elapsedDays}d ago`;
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: Colors.dark.background,
    flex: 1,
  },
  container: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerButtonPlaceholder: {
    height: 40,
    width: 40,
  },
  titleGroup: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.84,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.five,
    paddingHorizontal: 18,
    paddingTop: Spacing.three,
  },
  threadList: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 9,
    borderWidth: 1,
    overflow: "hidden",
  },
  threadRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  threadIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 15,
    flexShrink: 0,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  threadCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  threadTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  threadPreview: {
    fontSize: 12,
    lineHeight: 16,
  },
  threadMeta: {
    fontSize: 9,
    lineHeight: 12,
    opacity: 0.78,
  },
  restoreButton: {
    alignItems: "center",
    backgroundColor: "rgba(44, 163, 111, 0.12)",
    borderColor: "rgba(147, 225, 182, 0.22)",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    flexShrink: 0,
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 9,
  },
  restoreButtonDisabled: {
    opacity: 0.56,
  },
  restoreButtonText: {
    color: "#93E1B6",
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 9,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: Spacing.four,
    paddingVertical: 32,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    marginBottom: 3,
    width: 40,
  },
  emptyTitle: {
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: Colors.dark.text,
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
