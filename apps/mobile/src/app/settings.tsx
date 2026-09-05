import { useSelector } from "@legendapp/state/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import SettingsScreenBase from "@/app-internal/settings-base";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { reconcileCodexRelayConnection } from "@/lib/codex-relay-connection-manager";
import {
  getCodexRelayConnectionMode,
  isLocalServerUrl,
  setCodexRelayConnectionMode,
  type CodexRelayConnectionMode,
} from "@/lib/codex-relay-server-url-storage";
import { hapticSelection, hapticWarning } from "@/lib/haptics";
import { clearServerState, setStatusState } from "@/lib/server-state";
import { getNativeTailcatStatus, isNativeTailcatAvailable } from "@/lib/transport/native-tailcat";
import { chatStore$, setConnection, setServerUrl } from "@/state/chat-store";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
const pathRefreshMs = 4_000;

type UserConnectionPath = "idle" | "lan" | "remote" | "switching" | "offline";
type UserConnectionMode = Extract<CodexRelayConnectionMode, "auto" | "local">;

const copy = isZhCn
  ? {
      title: "连接",
      pathTitle: "当前连接",
      description: "自动模式会优先使用局域网，并在离开当前网络后自动切换到安全远程连接。",
      unavailableTitle: "连接方式不可用",
      unavailableFallback: "当前连接方式无法访问已配对的电脑。",
      modes: {
        auto: { label: "自动", subtitle: "优先局域网，需要时自动切换远程" },
        local: { label: "仅局域网", subtitle: "只在同一 Wi‑Fi / LAN 下连接" },
      },
      paths: {
        idle: { label: "等待连接", detail: "尚未建立可用连接", shortLabel: "等待" },
        lan: { label: "局域网", detail: "正在使用本地 Wi‑Fi / LAN", shortLabel: "LAN" },
        remote: { label: "远程", detail: "正在使用安全远程连接", shortLabel: "远程" },
        switching: { label: "正在切换", detail: "正在寻找可用连接", shortLabel: "…" },
        offline: { label: "离线", detail: "正在等待网络恢复", shortLabel: "离线" },
      },
      active: "当前",
      use: "使用",
      checking: "检查中",
      close: "关闭",
    }
  : {
      title: "Connection",
      pathTitle: "Current connection",
      description: "Automatic prefers LAN and switches to a secure remote connection when you leave the local network.",
      unavailableTitle: "Connection mode unavailable",
      unavailableFallback: "Could not reach the paired computer with this connection mode.",
      modes: {
        auto: { label: "Automatic", subtitle: "Prefer LAN and switch remote when needed" },
        local: { label: "Local network only", subtitle: "Connect only on the same Wi-Fi / LAN" },
      },
      paths: {
        idle: { label: "Waiting", detail: "No usable connection is active yet", shortLabel: "WAIT" },
        lan: { label: "Local network", detail: "Using local Wi-Fi / LAN", shortLabel: "LAN" },
        remote: { label: "Remote", detail: "Using a secure remote connection", shortLabel: "REMOTE" },
        switching: { label: "Switching", detail: "Finding an available connection", shortLabel: "…" },
        offline: { label: "Offline", detail: "Waiting for the network to recover", shortLabel: "OFFLINE" },
      },
      active: "ACTIVE",
      use: "USE",
      checking: "CHECKING",
      close: "Close",
    };

const connectionModes: UserConnectionMode[] = ["auto", "local"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const connection = useSelector(() => chatStore$.connection.get());
  const connectionError = useSelector(() => chatStore$.error.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const serverUrl = useSelector(() => chatStore$.serverUrl.get());
  const [connectionMode, setConnectionMode] = useState<CodexRelayConnectionMode>(() =>
    getCodexRelayConnectionMode(),
  );
  const [path, setPath] = useState<UserConnectionPath>(() =>
    inferConnectionPath(connection, serverUrl, hasPairedSession),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [switching, setSwitching] = useState(false);
  const activePath = copy.paths[path];

  useEffect(() => {
    if (connectionMode !== "remote") {
      return;
    }
    setCodexRelayConnectionMode("auto");
    setConnectionMode("auto");
  }, [connectionMode]);

  useEffect(() => {
    let active = true;

    async function refreshPath() {
      const fallback = inferConnectionPath(connection, serverUrl, hasPairedSession);
      if (!hasPairedSession || !isNativeTailcatAvailable() || connectionMode === "local") {
        if (active) {
          setPath(fallback);
        }
        return;
      }

      const nativeStatus = await getNativeTailcatStatus().catch(() => ({ path: "offline" as const }));
      if (!active) {
        return;
      }
      setPath(userPathFromNative(nativeStatus.path, fallback));
    }

    void refreshPath();
    const timer = setInterval(() => void refreshPath(), pathRefreshMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connection, connectionMode, hasPairedSession, serverUrl]);

  async function selectConnectionMode(mode: UserConnectionMode) {
    if (switching || !hasPairedSession || mode === connectionMode) {
      return;
    }

    const previousMode = connectionMode;
    const previousConnection = connection;
    const previousError = connectionError;
    hapticSelection();
    setSwitching(true);
    setConnectionMode(mode);
    setCodexRelayConnectionMode(mode);
    await queryClient.cancelQueries();
    setConnection("checking");

    try {
      const reconciled = await reconcileCodexRelayConnection();
      clearServerState(queryClient);
      setServerUrl(reconciled.serverUrl);
      setStatusState(queryClient, reconciled.status);
      setConnection("connected");
      setPath(inferConnectionPath("connected", reconciled.serverUrl, true));
      setRefreshKey((value) => value + 1);
      setModalVisible(false);
      void queryClient.invalidateQueries();
    } catch (error) {
      setCodexRelayConnectionMode(previousMode);
      setConnectionMode(previousMode);
      setConnection(previousConnection, previousError);
      hapticWarning();
      Alert.alert(
        copy.unavailableTitle,
        error instanceof Error ? error.message : copy.unavailableFallback,
      );
    } finally {
      setSwitching(false);
    }
  }

  return (
    <View style={styles.root}>
      <SettingsScreenBase key={refreshKey} />
      <Pressable
        accessibilityLabel={`${copy.pathTitle}: ${activePath.label}`}
        accessibilityRole="button"
        disabled={!hasPairedSession}
        onPress={() => {
          hapticSelection();
          setModalVisible(true);
        }}
        style={({ pressed }) => [
          styles.pathButton,
          { top: insets.top + 6 },
          !hasPairedSession && styles.pathButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.pathDot, pathDotStyle(path)]} />
        <ThemedText type="code" style={styles.pathButtonText}>
          {hasPairedSession ? activePath.shortLabel : copy.paths.idle.shortLabel}
        </ThemedText>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <ThemedText type="smallBold" style={styles.modalTitle}>
                  {copy.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.modalSubtitle}>
                  {copy.description}
                </ThemedText>
              </View>
              <Pressable
                accessibilityLabel={copy.close}
                accessibilityRole="button"
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <ThemedText type="code" style={styles.closeButtonText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            <View accessible accessibilityLabel={`${copy.pathTitle}: ${activePath.label}`} style={styles.pathCard}>
              <View style={[styles.pathDotLarge, pathDotStyle(path)]} />
              <View style={styles.pathCopy}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.pathEyebrow}>
                  {copy.pathTitle}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.pathTitle}>
                  {activePath.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pathDetail}>
                  {activePath.detail}
                </ThemedText>
              </View>
            </View>

            <View style={styles.modeList}>
              {connectionModes.map((mode) => {
                const option = copy.modes[mode];
                const selected = mode === connectionMode;
                return (
                  <Pressable
                    key={mode}
                    accessibilityLabel={`${copy.title}: ${option.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: switching || selected }}
                    disabled={switching || selected}
                    onPress={() => void selectConnectionMode(mode)}
                    style={({ pressed }) => [
                      styles.modeRow,
                      selected && styles.modeRowSelected,
                      switching && styles.modeRowDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.modeCopy}>
                      <ThemedText type="smallBold" style={styles.modeTitle}>
                        {option.label}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.modeSubtitle}>
                        {option.subtitle}
                      </ThemedText>
                    </View>
                    <View style={[styles.modeBadge, selected && styles.modeBadgeSelected]}>
                      <ThemedText
                        type="code"
                        style={[styles.modeBadgeText, selected && styles.modeBadgeTextSelected]}
                      >
                        {switching && selected ? copy.checking : selected ? copy.active : copy.use}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function inferConnectionPath(
  connection: string,
  serverUrl: string,
  hasPairedSession: boolean,
): UserConnectionPath {
  if (!hasPairedSession) {
    return "idle";
  }
  if (connection === "offline") {
    return "offline";
  }
  if (connection !== "connected") {
    return "switching";
  }
  return isLocalServerUrl(serverUrl) ? "lan" : "remote";
}

function userPathFromNative(path: string, fallback: UserConnectionPath): UserConnectionPath {
  switch (path) {
    case "lan":
      return "lan";
    case "direct":
    case "derp":
      return "remote";
    case "connecting":
      return "switching";
    case "offline":
      return "offline";
    case "idle":
    default:
      return fallback;
  }
}

function pathDotStyle(path: UserConnectionPath) {
  if (path === "lan" || path === "remote") {
    return styles.pathDotHealthy;
  }
  if (path === "switching") {
    return styles.pathDotDegraded;
  }
  return styles.pathDotOffline;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pathButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    height: 40,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 10,
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  pathButtonDisabled: {
    opacity: 0.5,
  },
  pathButtonText: {
    color: Colors.dark.text,
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
  },
  pathDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  pathDotLarge: {
    borderRadius: 5,
    flexShrink: 0,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  pathDotHealthy: {
    backgroundColor: "#2CA36F",
  },
  pathDotDegraded: {
    backgroundColor: "#F2B84B",
  },
  pathDotOffline: {
    backgroundColor: "#D84F4F",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalPanel: {
    backgroundColor: Colors.dark.background,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.three,
    maxWidth: 480,
    padding: Spacing.four,
    width: "100%",
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.three,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    flexShrink: 0,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeButtonText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 18,
    lineHeight: 20,
  },
  pathCard: {
    alignItems: "flex-start",
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: Spacing.three,
  },
  pathCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pathEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    opacity: 0.72,
  },
  pathTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  pathDetail: {
    fontSize: 12,
    lineHeight: 16,
  },
  modeList: {
    gap: 8,
  },
  modeRow: {
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    minHeight: 68,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  modeRowSelected: {
    backgroundColor: "rgba(44, 163, 111, 0.10)",
    borderColor: "rgba(147, 225, 182, 0.22)",
  },
  modeRowDisabled: {
    opacity: 0.7,
  },
  modeCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  modeTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  modeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  modeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 58,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  modeBadgeSelected: {
    backgroundColor: "rgba(44, 163, 111, 0.14)",
    borderColor: "rgba(147, 225, 182, 0.25)",
  },
  modeBadgeText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
  },
  modeBadgeTextSelected: {
    color: "#93E1B6",
  },
  pressed: {
    opacity: 0.7,
  },
});
