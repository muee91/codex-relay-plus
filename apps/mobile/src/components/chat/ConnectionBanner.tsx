import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";

const copy = isZhCn
  ? {
      reconnectingTitle: "正在重新连接 Mac",
      reconnectingChecking: "正在寻找可用连接…",
      reconnectingOffline: "网络变化时会自动尝试局域网和远程连接。",
      connectTitle: "连接你的 Mac",
      connectSubtitle: "配对一次，之后在可用网络下会自动恢复连接。",
      introTitle: "从 Mac 端开始",
      introBody: "打开 Codex Relay Plus 桌面端，在主窗口里找到“添加手机”。",
      steps: [
        { icon: "workspace" as const, label: "1", title: "打开桌面端", body: "确认 Mac 上的 Relay 显示为已就绪。" },
        { icon: "check" as const, label: "2", title: "扫描二维码", body: "用这台手机扫描桌面端显示的配对二维码。" },
        { icon: "terminal" as const, label: "3", title: "批准手机", body: "回到 Mac 端确认这台手机，配对随后自动完成。" },
      ],
      scan: "扫描二维码",
      refresh: "重新连接",
    }
  : {
      reconnectingTitle: "Reconnecting to your Mac",
      reconnectingChecking: "Finding an available connection…",
      reconnectingOffline: "Codex Relay will retry local and remote paths automatically.",
      connectTitle: "Connect your Mac",
      connectSubtitle: "Pair once, then Codex Relay reconnects automatically whenever a path is available.",
      introTitle: "Start on your Mac",
      introBody: "Open Codex Relay Plus on your Mac and find Add phone in the main window.",
      steps: [
        { icon: "workspace" as const, label: "1", title: "Open the desktop app", body: "Make sure the Relay status on your Mac shows Ready." },
        { icon: "check" as const, label: "2", title: "Scan the QR code", body: "Use this phone to scan the pairing QR shown on your Mac." },
        { icon: "terminal" as const, label: "3", title: "Approve this phone", body: "Confirm the phone on your Mac. Pairing finishes automatically." },
      ],
      scan: "Scan QR",
      refresh: "Reconnect",
    };

export function ConnectionBanner({
  connection,
  hasPairedSession,
  onRefresh,
  onScanConnect,
}: {
  connection: "checking" | "connected" | "offline";
  error?: string;
  hasPairedSession: boolean;
  onRefresh: () => void;
  onScanConnect: () => void;
  serverUrl: string;
  workspacePath?: string;
}) {
  if (connection === "connected") {
    return null;
  }

  if (hasPairedSession) {
    return (
      <Animated.View
        entering={connectionBannerEnterTransition}
        exiting={connectionBannerExitTransition}
        layout={connectionBannerLayoutTransition}
        style={styles.container}
      >
        <Animated.View layout={connectionBannerLayoutTransition} style={styles.reconnectPanel}>
          <View
            style={[
              styles.statusDot,
              connection === "checking" ? styles.statusDotChecking : styles.statusDotOffline,
            ]}
          />
          <View style={styles.reconnectCopy}>
            <ThemedText type="smallBold" style={styles.reconnectTitle}>
              {copy.reconnectingTitle}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.reconnectSubtitle}
              numberOfLines={2}
            >
              {connection === "checking" ? copy.reconnectingChecking : copy.reconnectingOffline}
            </ThemedText>
          </View>
          {connection === "offline" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.refresh}
              hitSlop={8}
              onPress={onRefresh}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Icon name="refresh" size={14} tintColor="#E7E8E5" />
            </Pressable>
          ) : null}
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={connectionBannerEnterTransition}
      exiting={connectionBannerExitTransition}
      layout={connectionBannerLayoutTransition}
      style={styles.container}
    >
      <Animated.View layout={connectionBannerLayoutTransition} style={styles.pairPanel}>
        <View style={styles.heroCopy}>
          <ThemedText type="smallBold" style={styles.heroTitle}>
            {copy.connectTitle}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
            {copy.connectSubtitle}
          </ThemedText>
        </View>

        <View style={styles.onboardingIntro}>
          <ThemedText type="smallBold" style={styles.onboardingTitle}>
            {copy.introTitle}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.onboardingCopy}>
            {copy.introBody}
          </ThemedText>
        </View>

        <View style={styles.stepList}>
          {copy.steps.map((step) => (
            <PairingStep key={step.label} {...step} />
          ))}
        </View>

        <Button
          accessibilityRole="button"
          accessibilityLabel={copy.scan}
          onPress={onScanConnect}
          size="lg"
          variant="default"
          className="h-11 rounded-xl"
          style={styles.pairButton}
        >
          <Icon name="workspace" size={16} tintColor="#141414" />
          <ThemedText type="smallBold" style={styles.primaryActionText}>
            {copy.scan}
          </ThemedText>
        </Button>
      </Animated.View>
    </Animated.View>
  );
}

function PairingStep({
  body,
  icon,
  label,
  title,
}: {
  body: string;
  icon: "check" | "terminal" | "workspace";
  label: string;
  title: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepMarker}>
        <ThemedText type="code" style={styles.stepNumber}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.stepCopy}>
        <View style={styles.stepTitleRow}>
          <Icon name={icon} size={14} tintColor="#DADCD8" />
          <ThemedText type="smallBold" style={styles.stepTitle}>
            {title}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.stepBody}>
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const connectionBannerLayoutTransition = LinearTransition.duration(180);
const connectionBannerEnterTransition = FadeIn.duration(150);
const connectionBannerExitTransition = FadeOut.duration(120);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
  reconnectPanel: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotChecking: {
    backgroundColor: "#D7B15D",
  },
  statusDotOffline: {
    backgroundColor: "#8B8F8D",
  },
  reconnectCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  reconnectTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  reconnectSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  pairPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    padding: 16,
  },
  heroCopy: {
    gap: 5,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 25,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  onboardingIntro: {
    gap: 4,
    paddingTop: 2,
  },
  onboardingTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  onboardingCopy: {
    fontSize: 12,
    lineHeight: 17,
  },
  stepList: {
    gap: 2,
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 11,
    minHeight: 56,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  stepMarker: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22,
  },
  stepNumber: {
    color: "#BFC3BE",
    fontSize: 9,
    lineHeight: 12,
  },
  stepCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  stepTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stepTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  stepBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  pairButton: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  primaryActionText: {
    color: "#141414",
    fontSize: 13,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.7,
  },
});
