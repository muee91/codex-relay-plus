import { useSelector } from "@legendapp/state/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import SettingsScreenBase from "@/app-internal/settings-base";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { reconcileCodexRelayConnection } from "@/lib/codex-relay-connection-manager";
import {
  getCodexRelayConnectionMode,
  setCodexRelayConnectionMode,
  type CodexRelayConnectionMode,
} from "@/lib/codex-relay-server-url-storage";
import { hapticSelection, hapticWarning } from "@/lib/haptics";
import { clearServerState, setStatusState } from "@/lib/server-state";
import { chatStore$, setConnection, setServerUrl } from "@/state/chat-store";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";

const copy = isZhCn
  ? {
      title: "连接方式",
      description: "自动模式优先使用局域网；局域网不可达时，再切换到可用的远程地址。",
      unavailableTitle: "连接方式不可用",
      unavailableFallback: "当前连接方式无法访问已配对的电脑。",
      modes: {
        auto: { label: "自动", subtitle: "优先局域网，不可用时切换远程", shortLabel: "自动" },
        local: { label: "仅局域网", subtitle: "永不使用远程连接", shortLabel: "LAN" },
        remote: { label: "仅远程", subtitle: "使用 Tailscale 或其他远程地址", shortLabel: "远程" },
      },
    }
  : {
      title: "Connection mode",
      description: "Automatic prefers LAN and switches to a reachable remote address when needed.",
      unavailableTitle: "Connection mode unavailable",
      unavailableFallback: "Could not reach the paired computer with this connection mode.",
      modes: {
        auto: {
          label: "Automatic",
          subtitle: "Prefer LAN, fall back to remote",
          shortLabel: "AUTO",
        },
        local: {
          label: "Local network only",
          subtitle: "Never use a remote path",
          shortLabel: "LAN",
        },
        remote: {
          label: "Remote only",
          subtitle: "Use Tailscale or another remote address",
          shortLabel: "REMOTE",
        },
      },
    };

const connectionModes: CodexRelayConnectionMode[] = ["auto", "local", "remote"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const connection = useSelector(() => chatStore$.connection.get());
  const connectionError = useSelector(() => chatStore$.error.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const [connectionMode, setConnectionMode] = useState(() => getCodexRelayConnectionMode());
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [switching, setSwitching] = useState(false);
  const activeCopy = useMemo(() => copy.modes[connectionMode], [connectionMode]);

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
        accessibilityLabel={copy.title}
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
        <ThemedText type="code" style={styles.modeButtonText}>
          {activeCopy.shortLabel}
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

            <View style={styles.modeList}>
              {connectionModes.map((mode) => {
                const option = copy.modes[mode];
                const selected = mode === connectionMode;
                const disabled = switching || (selected && mode !== "auto");
                return (
                  <Pressable
                    key={mode}
                    accessibilityLabel={option.label}
                    accessibilityRole="button"
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
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.modeSubtitle}
                      >
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    minWidth: 40,
    paddingHorizontal: 8,
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
