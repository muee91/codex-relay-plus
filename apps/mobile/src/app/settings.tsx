import { useSelector } from "@legendapp/state/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import {
  getNativeTailcatStatus,
  isNativeTailcatAvailable,
  type TailcatPathStatus,
} from "@/lib/transport/native-tailcat";
import { chatStore$, setConnection, setServerUrl } from "@/state/chat-store";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
const pathRefreshMs = 4_000;

type ConnectionPathStatus =
  | TailcatPathStatus
  | {
      endpoint?: string;
      latencyMs?: number;
      path: "remote";
    };

const copy = isZhCn
  ? {
      title: "连接",
      modeTitle: "连接模式",
      pathTitle: "当前连接",
      description: "自动模式优先使用局域网，需要时会自动切换到安全远程连接。",
      unavailableTitle: "连接方式不可用",
      unavailableFallback: "当前连接方式无法访问已配对的电脑。",
      modes: {
        auto: { label: "自动", subtitle: "推荐。优先局域网，需要时自动远程连接", shortLabel: "自动" },
        local: { label: "仅局域网", subtitle: "只在同一 Wi-Fi / LAN 下连接", shortLabel: "LAN" },
        remote: { label: "仅远程", subtitle: "仅使用远程连接", shortLabel: "远程" },
      },
      paths: {
        idle: { label: "等待连接", detail: "尚未建立可用连接", shortLabel: "AUTO" },
        lan: { label: "局域网", detail: "正在使用本地网络", shortLabel: "LAN" },
        connecting: { label: "正在连接", detail: "正在选择可用连接", shortLabel: "…" },
        direct: { label: "远程", detail: "正在使用安全远程连接", shortLabel: "REMOTE" },
        derp: { label: "远程", detail: "正在使用安全远程连接", shortLabel: "REMOTE" },
        remote: { label: "远程", detail: "正在使用安全远程连接", shortLabel: "REMOTE" },
        offline: { label: "离线", detail: "正在等待可用网络", shortLabel: "OFFLINE" },
      },
    }
  : {
      title: "Connection",
      modeTitle: "Connection mode",
      pathTitle: "Current connection",
      description: "Automatic prefers the local network and switches to a secure remote connection when needed.",
      unavailableTitle: "Connection mode unavailable",
      unavailableFallback: "Could not reach the paired computer with this connection mode.",
      modes: {
        auto: {
          label: "Automatic",
          subtitle: "Recommended. Prefer LAN and switch remotely when needed",
          shortLabel: "AUTO",
        },
        local: {
          label: "Local network only",
          subtitle: "Connect only on the same Wi-Fi / LAN",
          shortLabel: "LAN",
        },
        remote: {
          label: "Remote only",
          subtitle: "Use only a remote connection",
          shortLabel: "REMOTE",
        },
      },
      paths: {
        idle: { label: "Waiting", detail: "No usable connection is active yet", shortLabel: "AUTO" },
        lan: { label: "Local network", detail: "Using the local network", shortLabel: "LAN" },
        connecting: { label: "Connecting", detail: "Choosing an available connection", shortLabel: "…" },
        direct: { label: "Remote", detail: "Using a secure remote connection", shortLabel: "REMOTE" },
        derp: { label: "Remote", detail: "Using a secure remote connection", shortLabel: "REMOTE" },
        remote: { label: "Remote", detail: "Using a secure remote connection", shortLabel: "REMOTE" },
        offline: { label: "Offline", detail: "Waiting for an available network", shortLabel: "OFFLINE" },
      },
    };

const connectionModes: CodexRelayConnectionMode[] = ["auto", "local"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const connection = useSelector(() => chatStore$.connection.get());
  const connectionError = useSelector(() => chatStore$.error.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const serverUrl = useSelector(() => chatStore$.serverUrl.get());
  const [connectionMode, setConnectionMode] = useState(() => getCodexRelayConnectionMode());
  const [pathStatus, setPathStatus] = useState<ConnectionPathStatus>(() =>
    inferNonNativePath(connection, serverUrl, hasPairedSession),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [switching, setSwitching] = useState(false);
  const activeCopy = useMemo(() => copy.modes[connectionMode], [connectionMode]);
  const activePath = copy.paths[pathStatus.path];

  useEffect(() => {
    let active = true;

    async function refreshPath() {
      const fallback = inferNonNativePath(connection, serverUrl, hasPairedSession);
      if (!hasPairedSession || !isNativeTailcatAvailable() || connectionMode === "local") {
        if (active) {
          setPathStatus(fallback);
        }
        return;
      }

      const next = await getNativeTailcatStatus().catch((): TailcatPathStatus => ({ path: "offline" }));
      if (active) {
        setPathStatus(next.path === "idle" && connection === "connected" ? fallback : next);
      }
    }

    void refreshPath();
    const timer = setInterval(() => void refreshPath(), pathRefreshMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connection, connectionMode, hasPairedSession, serverUrl]);

  async function selectConnectionMode(mode: CodexRelayConnectionMode) {
    if (switching || !hasPairedSession || (mode === connectionMode && mode !== "auto")) {
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
      if (isNativeTailcatAvailable() && mode !== "local") {
        const next = await getNativeTailcatStatus().catch(
          (): TailcatPathStatus => ({ path: "offline" }),
        );
        setPathStatus(
          next.path === "idle"
            ? inferNonNativePath("connected", reconciled.serverUrl, true)
            : next,
        );
      } else {
        setPathStatus(inferNonNativePath("connected", reconciled.serverUrl, true));
      }
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
          styles.modeButton,
          { top: insets.top + 6 },
          !hasPairedSession && styles.modeButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.pathDot, pathDotStyle(pathStatus.path)]} />
        <ThemedText type="code" style={styles.modeButtonText}>
          {hasPairedSession ? activePath.shortLabel : activeCopy.shortLabel}
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
                accessibilityLabel={isZhCn ? "关闭" : "Close"}
                accessibilityRole="button"
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <ThemedText type="code" style={styles.closeButtonText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            <View
              accessible
              accessibilityLabel={`${copy.pathTitle}: ${activePath.label}`}
              style={styles.pathCard}
            >
              <View style={[styles.pathDotLarge, pathDotStyle(pathStatus.path)]} />
              <View style={styles.pathCopy}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.pathEyebrow}>
                  {copy.pathTitle}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.pathTitle}>
                  {activePath.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pathDetail}>
                  {pathDetail(pathStatus, activePath.detail)}
                </ThemedText>
              </View>
            </View>

            <ThemedText type="code" themeColor="textSecondary" style={styles.sectionLabel}>
              {copy.modeTitle}
            </ThemedText>
            <View style={styles.modeList}>
              {connectionModes.map((mode) => {
                const option = copy.modes[mode];
                const selected = mode === connectionMode;
                const disabled = switching || (selected && mode !== "auto");
                return (
                  <Pressable
                    key={mode}
                    accessibilityLabel={`${copy.modeTitle}: ${option.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => void selectConnectionMode(mode)}
                    style={({ pressed }) => [
                      styles.modeRow,
                      selected && styles.modeRowSelected,
                      disabled && styles.modeRowDisabled,
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
                        {switching && selected
                          ? isZhCn
                            ? "检查中"
                            : "CHECKING"
                          : selected
                            ? isZhCn
                              ? "当前"
                              : "ACTIVE"
                            : isZhCn
                              ? "使用"
                              : "USE"}
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

function inferNonNativePath(
  connection: string,
  serverUrl: string,
  hasPairedSession: boolean,
): ConnectionPathStatus {
  if (!hasPairedSession) {
    return { path: "idle" };
  }
  if (connection === "offline") {
    return { path: "offline" };
  }
  if (connection !== "connected") {
    return { path: "connecting" };
  }
  return isLocalServerUrl(serverUrl)
    ? { endpoint: serverUrl, path: "lan" }
    : { endpoint: serverUrl, path: "remote" };
}

function pathDetail(status: ConnectionPathStatus, fallback: string) {
  if ("error" in status && status.error && status.path === "offline") {
    return status.error;
  }
  return fallback;
}

function pathDotStyle(path: ConnectionPathStatus["path"]) {
  if (path === "lan" || path === "direct" || path === "derp" || path === "remote") {
    return styles.pathDotHealthy;
  }
  if (path === "connecting") {
    return styles.pathDotDegraded;
  }
  return styles.pathDotOffline;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    height: 40,
    justifyContent: "center",
    minWidth: 52,
    paddingHorizontal: 9,
    position: "absolute",
    right: 18,
  },
  modeButtonDisabled: { opacity: 0.34 },
  modeButtonText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    lineHeight: 12,
  },
  pathDot: { borderRadius: 4, height: 7, width: 7 },
  pathDotLarge: { borderRadius: 5, height: 10, marginTop: 4, width: 10 },
  pathDotHealthy: { backgroundColor: "#93E1B6" },
  pathDotDegraded: { backgroundColor: "#F2C66D" },
  pathDotOffline: { backgroundColor: "#8B8F8D" },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  modalPanel: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.three,
    maxWidth: 480,
    padding: Spacing.four,
    width: "100%",
  },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.three },
  modalHeaderCopy: { flex: 1, gap: 4, minWidth: 0 },
  modalTitle: { fontSize: 17, lineHeight: 22 },
  modalSubtitle: { fontSize: 12, lineHeight: 17 },
  closeButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeButtonText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 20,
    lineHeight: 24,
  },
  pathCard: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  pathCopy: { flex: 1, gap: 2, minWidth: 0 },
  pathEyebrow: { fontSize: 9, lineHeight: 12, textTransform: "uppercase" },
  pathTitle: { fontSize: 15, lineHeight: 20 },
  pathDetail: { fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 9, lineHeight: 12, textTransform: "uppercase" },
  modeList: { gap: 8 },
  modeRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeRowSelected: {
    backgroundColor: "rgba(44, 163, 111, 0.12)",
    borderColor: "rgba(147, 225, 182, 0.24)",
  },
  modeRowDisabled: { opacity: 0.78 },
  modeCopy: { flex: 1, gap: 2, minWidth: 0 },
  modeTitle: { fontSize: 14, lineHeight: 19 },
  modeSubtitle: { fontSize: 12, lineHeight: 16 },
  modeBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    minWidth: 62,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  modeBadgeSelected: {
    backgroundColor: "rgba(44, 163, 111, 0.16)",
    borderColor: "rgba(147, 225, 182, 0.28)",
  },
  modeBadgeText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    lineHeight: 12,
  },
  modeBadgeTextSelected: { color: "#93E1B6" },
  pressed: { opacity: 0.7 },
});