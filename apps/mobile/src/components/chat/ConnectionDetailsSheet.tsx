import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { AppBottomSheet, SheetActionRow } from "@/components/ui/bottom-sheet";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";
import type { TailcatPathStatus } from "@/lib/transport/native-tailcat";

export function ConnectionDetailsSheet({
  connection,
  error,
  machineName,
  onClose,
  onRefresh,
  onSwitchHost,
  pathStatus,
  serverUrl,
  visible,
}: {
  connection: "checking" | "connected" | "offline";
  error?: string;
  machineName?: string;
  onClose: () => void;
  onRefresh: () => void;
  onSwitchHost: () => void;
  pathStatus: TailcatPathStatus;
  serverUrl: string;
  visible: boolean;
}) {
  const theme = useTheme();
  const route = routeLabel(connection, pathStatus);

  return (
    <AppBottomSheet
      onClose={onClose}
      subtitle={machineName ?? compactServer(serverUrl)}
      title="Connection"
      visible={visible}
    >
      <View style={styles.summary}>
        <ConnectionRow label="Status" value={connectionLabel(connection)} />
        <ConnectionRow label="Route" value={route} />
        {pathStatus.latencyMs !== undefined ? (
          <ConnectionRow label="Latency" value={`${Math.max(0, Math.round(pathStatus.latencyMs))} ms`} />
        ) : null}
        {pathStatus.endpoint ? <ConnectionRow label="Endpoint" value={pathStatus.endpoint} /> : null}
        {pathStatus.derpRegion ? (
          <ConnectionRow label="DERP region" value={pathStatus.derpRegion} />
        ) : null}
        <ConnectionRow label="Relay" value={compactServer(serverUrl)} />
        {error || pathStatus.error ? (
          <View style={styles.errorCard}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Last connection error</Text>
            <Text style={[styles.errorBody, { color: theme.textSecondaryStrong }]}>
              {error ?? pathStatus.error}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <SheetActionRow
          accessibilityLabel="Refresh relay connection"
          icon="refresh"
          onPress={onRefresh}
          subtitle="Probe the current LAN or Tailcat route now"
          title="Reconnect now"
        />
        <SheetActionRow
          accessibilityLabel="Switch Codex Relay host"
          icon="workspace"
          onPress={onSwitchHost}
          subtitle="Choose another saved computer"
          title="Switch host"
        />
      </View>
    </AppBottomSheet>
  );
}

function ConnectionRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text numberOfLines={2} selectable style={[styles.value, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

function connectionLabel(connection: "checking" | "connected" | "offline") {
  switch (connection) {
    case "connected":
      return "Connected";
    case "checking":
      return "Reconnecting";
    case "offline":
      return "Offline";
  }
}

function routeLabel(
  connection: "checking" | "connected" | "offline",
  status: TailcatPathStatus,
) {
  if (connection === "offline") {
    return status.path === "offline" ? "Transport offline" : "Unavailable";
  }
  switch (status.path) {
    case "lan":
      return "LAN";
    case "direct":
      return "Tailcat Direct";
    case "derp":
      return "Tailcat Relay";
    case "connecting":
      return "Tailcat connecting";
    case "offline":
      return "Tailcat offline";
    case "idle":
      return connection === "connected" ? "Relay connection" : "Not active";
  }
}

function compactServer(serverUrl: string) {
  return serverUrl ? serverUrl.replace(/^https?:\/\//, "") : "Not paired";
}

const styles = StyleSheet.create({
  summary: {
    gap: 2,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "flex-start",
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 42,
    paddingVertical: 10,
  },
  label: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 16,
    width: 88,
  },
  value: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    minWidth: 0,
    textAlign: "right",
  },
  errorCard: {
    backgroundColor: "rgba(255, 122, 122, 0.08)",
    borderColor: "rgba(255, 122, 122, 0.16)",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
    marginTop: 10,
    padding: 10,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  errorBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    paddingHorizontal: 8,
  },
});
