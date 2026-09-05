import { useSelector } from "@legendapp/state/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { FaGithub } from "@/assets/icons/fa";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import {
  codexRelayRepositoryLabel,
  codexRelayRepositoryUrl,
  codexRelaySponsorLabel,
  codexRelaySponsorUrl,
} from "@/constants/links";
import { Colors, Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getPushNotificationSettings,
  registerPushNotifications,
  signOutCodexRelaySession,
  unregisterPushNotifications,
} from "@/lib/codex-relay-api";
import { hapticSelection, hapticWarning } from "@/lib/haptics";
import { formatMobileReleaseVersion } from "@/lib/mobile-release-version";
import {
  defaultPushNotificationPreferences,
  getExpoPushToken,
  markInitialPushNotificationRegistrationCompleted,
  pushNotificationPlatform,
  supportsPushNotifications,
} from "@/lib/push-notifications";
import { formatRateLimitRemaining, visibleRateLimitRows } from "@/lib/rate-limits";
import { clearServerState, serverStateKeys, serverStateQueryFns } from "@/lib/server-state";
import { chatStore$, resetChatSessionState } from "@/state/chat-store";

import mobilePackage from "../../package.json";

const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
const archivedCopy = isZhCn
  ? {
      section: "会话",
      title: "已归档会话",
      subtitle: "查看并恢复已归档的会话",
      accessibilityLabel: "打开已归档会话",
    }
  : {
      section: "Chats",
      title: "Archived chats",
      subtitle: "View and restore chats you archived",
      accessibilityLabel: "Open archived chats",
    };

const pushNotificationTrackColor = {
  false: "rgba(255, 255, 255, 0.16)",
  true: "#2CA36F",
};

type PushNotificationPreference = keyof typeof defaultPushNotificationPreferences;

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const connection = useSelector(() => chatStore$.connection.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const serverUrl = useSelector(() => chatStore$.serverUrl.get());
  const statusQuery = useQuery({
    queryKey: serverStateKeys.status(),
    queryFn: serverStateQueryFns.status,
    enabled: false,
  });
  const rateLimitsQuery = useQuery({
    queryKey: serverStateKeys.rateLimits(),
    queryFn: serverStateQueryFns.rateLimits,
    enabled: connection === "connected",
  });
  const machineName = statusQuery.data?.machineName;
  const computerName = hasPairedSession
    ? (machineName ?? connectedComputerName(serverUrl))
    : "No paired computer";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const releaseVersionLabel = formatMobileReleaseVersion(appVersion, mobilePackage.version);
  const [pushNotificationPreferences, setPushNotificationPreferences] = useState(
    defaultPushNotificationPreferences,
  );
  const [pushNotificationsLoading, setPushNotificationsLoading] = useState(false);
  const [pushNotificationsUpdating, setPushNotificationsUpdating] = useState(false);
  const pushNotificationsSupported = supportsPushNotifications();
  const rateLimitRows = visibleRateLimitRows(rateLimitsQuery.data?.buckets ?? []);

  useEffect(() => {
    let isActive = true;
    if (!hasPairedSession || !pushNotificationsSupported) {
      setPushNotificationPreferences(defaultPushNotificationPreferences);
      setPushNotificationsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setPushNotificationsLoading(true);
    void getPushNotificationSettings()
      .then((settings) => {
        if (isActive) {
          setPushNotificationPreferences(settings.preferences);
        }
      })
      .catch(() => {
        if (isActive) {
          setPushNotificationPreferences(defaultPushNotificationPreferences);
        }
      })
      .finally(() => {
        if (isActive) {
          setPushNotificationsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasPairedSession, pushNotificationsSupported, serverUrl]);

  function closeSettings() {
    hapticSelection();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  function openArchivedChats() {
    hapticSelection();
    router.push("/archived");
  }

  function signOut() {
    hapticWarning();
    signOutCodexRelaySession();
    clearServerState(queryClient);
    resetChatSessionState();
    router.replace("/");
  }

  async function updatePushNotificationPreference(
    preference: PushNotificationPreference,
    value: boolean,
  ) {
    if (pushNotificationsUpdating || !pushNotificationsSupported) {
      return;
    }

    const previousPreferences = pushNotificationPreferences;
    const nextPreferences = { ...previousPreferences, [preference]: value };
    hapticSelection();
    markInitialPushNotificationRegistrationCompleted();
    setPushNotificationPreferences(nextPreferences);
    setPushNotificationsUpdating(true);

    try {
      const settings =
        nextPreferences.actionRequired || nextPreferences.turnTerminal
          ? await registerPushNotifications({
              expoPushToken: await getExpoPushToken(),
              platform: pushNotificationPlatform(),
              preferences: nextPreferences,
            })
          : await unregisterPushNotifications();
      setPushNotificationPreferences(settings.preferences);
    } catch (caught) {
      setPushNotificationPreferences(previousPreferences);
      hapticWarning();
      Alert.alert("Notifications unavailable", settingsErrorMessage(caught));
    } finally {
      setPushNotificationsUpdating(false);
    }
  }

  function openProjectLink(url: string) {
    hapticSelection();
    void Linking.openURL(url);
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to threads"
            onPress={closeSettings}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Icon name="back" size={19} tintColor={Colors.dark.text} />
          </Pressable>
          <View style={styles.titleGroup}>
            <ThemedText type="smallBold" style={styles.title}>
              Settings
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary" style={styles.subtitle}>
              Account
            </ThemedText>
          </View>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Connected Computer
            </ThemedText>
            <View style={styles.connectionPanel}>
              <View style={styles.connectionHeader}>
                <View
                  style={[
                    styles.connectionDot,
                    connection === "connected" && styles.connectionDotConnected,
                    connection === "offline" && styles.connectionDotOffline,
                  ]}
                />
                <ThemedText type="smallBold" style={styles.connectionTitle} numberOfLines={1}>
                  {computerName}
                </ThemedText>
                <View style={styles.connectionBadge}>
                  <ThemedText type="code" style={styles.connectionBadgeText}>
                    {connectionLabel(connection)}
                  </ThemedText>
                </View>
              </View>
              {hasPairedSession ? (
                <InfoLine label="Relay" value={compactServer(serverUrl)} />
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.unpairedCopy}>
                  Pair this device from the main screen to connect to your computer.
                </ThemedText>
              )}
            </View>
          </View>

          {hasPairedSession ? (
            <View style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                {archivedCopy.section}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={archivedCopy.accessibilityLabel}
                onPress={openArchivedChats}
                style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
              >
                <View style={styles.actionIcon}>
                  <Icon name="archive" size={17} tintColor={Colors.dark.textSecondary} />
                </View>
                <View style={styles.actionCopy}>
                  <ThemedText type="smallBold" style={styles.actionTitle}>
                    {archivedCopy.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.actionSubtitle}>
                    {archivedCopy.subtitle}
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={16} tintColor={Colors.dark.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Usage Limits
            </ThemedText>
            <View style={styles.usageCard}>
              {rateLimitRows.length > 0 ? (
                rateLimitRows.map((row, index) => (
                  <RateLimitProgressRow
                    key={row.id}
                    label={row.label}
                    remainingText={formatRateLimitRemaining(row.window)}
                    remainingPercent={row.window.remainingPercent}
                    usedPercent={row.window.usedPercent}
                    showDivider={index < rateLimitRows.length - 1}
                  />
                ))
              ) : (
                <View style={styles.usageRow}>
                  <View style={styles.usageCopy}>
                    <ThemedText type="smallBold" style={styles.usageTitle}>
                      Rate limits
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.usageSubtitle}
                    >
                      {rateLimitsQuery.isFetching
                        ? "Checking current usage"
                        : "Unavailable from this runtime"}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>
          </View>

          {hasPairedSession ? (
            <View style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                Notifications
              </ThemedText>
              <View style={styles.notificationPanel}>
                {pushNotificationsSupported ? (
                  <>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.notificationIntro}
                    >
                      Generic alerts only. Chat content stays on your paired computer.
                    </ThemedText>
                    <PushNotificationToggle
                      accessibilityLabel="Notify when a Codex turn ends"
                      disabled={pushNotificationsLoading || pushNotificationsUpdating}
                      onValueChange={(value) =>
                        void updatePushNotificationPreference("turnTerminal", value)
                      }
                      subtitle="When Codex completes or fails a turn"
                      title="Turn complete"
                      value={pushNotificationPreferences.turnTerminal}
                    />
                    <PushNotificationToggle
                      accessibilityLabel="Notify when Codex needs action"
                      disabled={pushNotificationsLoading || pushNotificationsUpdating}
                      onValueChange={(value) =>
                        void updatePushNotificationPreference("actionRequired", value)
                      }
                      showDivider={false}
                      subtitle="When Codex needs approval or input"
                      title="Action required"
                      value={pushNotificationPreferences.actionRequired}
                    />
                  </>
                ) : (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.notificationIntroStandalone}
                  >
                    Push notifications are available in the iOS and Android apps.
                  </ThemedText>
                )}
              </View>
            </View>
          ) : null}

          {hasPairedSession ? (
            <View style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                Session
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={signOut}
                style={({ pressed }) => [styles.signOutRow, pressed && styles.pressed]}
              >
                <View style={styles.signOutContent}>
                  <View style={styles.signOutIconSlot}>
                    <Icon name="signOut" size={17} tintColor="#FFB4A8" />
                  </View>
                  <View style={styles.signOutCopy}>
                    <ThemedText type="smallBold" style={styles.signOutTitle}>
                      Sign out
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.signOutSubtitle}
                    >
                      Remove this pairing from the phone
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Project
            </ThemedText>
            <View style={styles.projectLinkList}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open Codex Relay GitHub repository"
                onPress={() => openProjectLink(codexRelayRepositoryUrl)}
                style={({ pressed }) => [styles.projectLinkRow, pressed && styles.pressed]}
              >
                <View style={styles.projectLinkIcon}>
                  <FaGithub size={17} color={Colors.dark.text} />
                </View>
                <View style={styles.projectLinkCopy}>
                  <ThemedText type="smallBold" style={styles.projectLinkTitle}>
                    GitHub
                  </ThemedText>
                  <ThemedText
                    type="code"
                    themeColor="textSecondary"
                    style={styles.projectLinkSubtitle}
                    numberOfLines={1}
                  >
                    {codexRelayRepositoryLabel}
                  </ThemedText>
                </View>
                <Icon name="externalLink" size={15} tintColor={Colors.dark.textSecondary} />
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open gronxb GitHub Sponsors"
                onPress={() => openProjectLink(codexRelaySponsorUrl)}
                style={({ pressed }) => [styles.projectLinkRow, pressed && styles.pressed]}
              >
                <View style={[styles.projectLinkIcon, styles.projectLinkIconSponsor]}>
                  <Heart size={16} color="#FF9FC0" fill="#FF9FC0" />
                </View>
                <View style={styles.projectLinkCopy}>
                  <ThemedText type="smallBold" style={styles.projectLinkTitle}>
                    Sponsor
                  </ThemedText>
                  <ThemedText
                    type="code"
                    themeColor="textSecondary"
                    style={styles.projectLinkSubtitle}
                    numberOfLines={1}
                  >
                    {codexRelaySponsorLabel}
                  </ThemedText>
                </View>
                <Icon name="externalLink" size={15} tintColor={Colors.dark.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.versionFooter}>
            <View style={styles.versionIcon}>
              <Icon name="permissionsAuto" size={12} tintColor={Colors.dark.textSecondary} />
            </View>
            <ThemedText type="code" themeColor="textSecondary" style={styles.versionText}>
              Version {releaseVersionLabel}
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function PushNotificationToggle({
  accessibilityLabel,
  disabled,
  onValueChange,
  showDivider = true,
  subtitle,
  title,
  value,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
  showDivider?: boolean;
  subtitle: string;
  title: string;
  value: boolean;
}) {
  return (
    <View style={[styles.notificationRow, showDivider && styles.notificationRowDivider]}>
      <View style={styles.notificationCopy}>
        <ThemedText type="smallBold" style={styles.notificationTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.notificationSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? "#DDF7E7" : "#BEC5C3"}
        trackColor={pushNotificationTrackColor}
        value={value}
      />
    </View>
  );
}

function RateLimitProgressRow({
  label,
  remainingPercent,
  remainingText,
  showDivider,
  usedPercent,
}: {
  label: string;
  remainingPercent: number;
  remainingText: string;
  showDivider: boolean;
  usedPercent: number;
}) {
  const clampedUsedPercent = clampPercent(usedPercent);
  const clampedRemainingPercent = clampPercent(remainingPercent);
  const progressColor = rateLimitProgressColor(clampedRemainingPercent);

  return (
    <View style={[styles.usageRow, showDivider && styles.usageRowDivider]}>
      <View style={styles.usageHeader}>
        <View style={styles.usageCopy}>
          <ThemedText type="smallBold" style={styles.usageTitle} numberOfLines={1}>
            {label}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.usageSubtitle}
            numberOfLines={1}
          >
            {remainingText} left
          </ThemedText>
        </View>
        <View style={[styles.usagePercentBadge, { borderColor: progressColor }]}>
          <ThemedText type="code" style={[styles.usagePercentText, { color: progressColor }]}>
            {clampedRemainingPercent}%
          </ThemedText>
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: 100,
          min: 0,
          now: clampedUsedPercent,
          text: `${clampedUsedPercent}% used`,
        }}
        style={styles.usageProgressTrack}
      >
        <View
          style={[
            styles.usageProgressFill,
            { backgroundColor: progressColor, width: `${clampedUsedPercent}%` },
          ]}
        />
      </View>
      <View style={styles.usageMetaRow}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.usageMetaText}>
          Used {clampedUsedPercent}%
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary" style={styles.usageMetaText}>
          Remaining {clampedRemainingPercent}%
        </ThemedText>
      </View>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.infoLineLabel}>
        {label}
      </ThemedText>
      <ThemedText type="code" style={styles.infoLineValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function connectedComputerName(serverUrl: string) {
  if (!serverUrl) {
    return "No computer paired";
  }
  try {
    return new URL(serverUrl).hostname;
  } catch {
    return compactServer(serverUrl);
  }
}

function compactServer(serverUrl: string) {
  return serverUrl ? serverUrl.replace(/^https?:\/\//, "") : "Not paired";
}

function connectionLabel(connection: "checking" | "connected" | "offline") {
  switch (connection) {
    case "connected":
      return "ONLINE";
    case "checking":
      return "CHECKING";
    case "offline":
      return "OFFLINE";
  }
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rateLimitProgressColor(remainingPercent: number) {
  if (remainingPercent <= 10) {
    return "#FF9B8D";
  }
  if (remainingPercent <= 30) {
    return "#F2B84B";
  }
  return "#93E1B6";
}

function settingsErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Could not update notification settings.";
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
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
    paddingHorizontal: 18,
    paddingTop: Spacing.three,
  },
  scroll: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.68,
  },
  connectionPanel: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  connectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 24,
  },
  connectionDot: {
    backgroundColor: "#F2B84B",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  connectionDotConnected: {
    backgroundColor: "#2CA36F",
  },
  connectionDotOffline: {
    backgroundColor: "#D84F4F",
  },
  connectionTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    minWidth: 0,
  },
  connectionBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  connectionBadgeText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    lineHeight: 12,
  },
  unpairedCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoLine: {
    gap: 2,
    minHeight: 20,
  },
  infoLineLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  infoLineValue: {
    color: Colors.dark.text,
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 15,
    flexShrink: 0,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  usageCard: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  usageRow: {
    gap: Spacing.two,
    minHeight: 84,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  usageRowDivider: {
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 1,
  },
  usageHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
  usageCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  usageTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  usageSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  usagePercentBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  usagePercentText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    lineHeight: 15,
  },
  usageProgressTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
    width: "100%",
  },
  usageProgressFill: {
    borderRadius: 999,
    height: "100%",
  },
  usageMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 14,
  },
  usageMetaText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
  },
  notificationPanel: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  notificationIntro: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  notificationIntroStandalone: {
    fontSize: 12,
    lineHeight: 17,
    padding: Spacing.three,
  },
  notificationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    minHeight: 70,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  notificationRowDivider: {
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 1,
  },
  notificationCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  notificationSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  signOutRow: {
    backgroundColor: "rgba(216, 79, 79, 0.08)",
    borderColor: "rgba(255, 180, 168, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: Spacing.three,
  },
  signOutContent: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 62,
    width: "100%",
  },
  signOutIconSlot: {
    alignItems: "center",
    backgroundColor: "rgba(216, 79, 79, 0.16)",
    borderRadius: 15,
    flexShrink: 0,
    height: 30,
    justifyContent: "center",
    marginRight: 12,
    width: 30,
  },
  signOutCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  signOutTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  signOutSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  projectLinkList: {
    backgroundColor: Colors.dark.backgroundElement,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: Spacing.two,
  },
  projectLinkRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  projectLinkIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    borderWidth: 1,
    flexShrink: 0,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  projectLinkIconSponsor: {
    backgroundColor: "rgba(255, 159, 192, 0.12)",
    borderColor: "rgba(255, 159, 192, 0.22)",
  },
  projectLinkCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  projectLinkTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  projectLinkSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  versionFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 2,
  },
  versionIcon: {
    alignItems: "center",
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  versionText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
