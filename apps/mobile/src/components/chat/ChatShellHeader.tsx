import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ThemedText } from "@/components/themed-text";
import { Icon, type AppIconName } from "@/components/ui/icon";
import { Colors } from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";

export type ChatShellAction = {
  readonly disabled?: boolean;
  readonly icon: AppIconName;
  readonly label: string;
  readonly onPress: () => void;
};

export type ChatConnectionBadge = {
  label: string;
  tone: "bad" | "good" | "muted" | "warn";
};

export function ChatShellHeader({
  connectionBadge,
  leadingAction,
  subtitle,
  title,
  trailingActions,
}: {
  connectionBadge?: ChatConnectionBadge;
  leadingAction: ChatShellAction;
  subtitle: string;
  title: string;
  trailingActions: readonly ChatShellAction[];
}) {
  const badgeToneStyle = connectionBadge
    ? {
        bad: styles.connectionBadge_bad,
        good: styles.connectionBadge_good,
        muted: styles.connectionBadge_muted,
        warn: styles.connectionBadge_warn,
      }[connectionBadge.tone]
    : undefined;
  const dotToneStyle = connectionBadge
    ? {
        bad: styles.connectionDot_bad,
        good: styles.connectionDot_good,
        muted: styles.connectionDot_muted,
        warn: styles.connectionDot_warn,
      }[connectionBadge.tone]
    : undefined;

  return (
    <View pointerEvents="box-none" style={styles.header}>
      <HeaderButton action={leadingAction} />
      <View pointerEvents="none" style={styles.titleGroup}>
        <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.metaRow}>
          {connectionBadge ? (
            <View style={[styles.connectionBadge, badgeToneStyle]}>
              <View style={[styles.connectionDot, dotToneStyle]} />
              <ThemedText type="code" style={styles.connectionLabel} numberOfLines={1}>
                {connectionBadge.label}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText
            type="code"
            themeColor="textSecondary"
            style={styles.subtitle}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        </View>
      </View>
      <View pointerEvents="box-none" style={styles.headerActions}>
        {trailingActions.map((action) => (
          <HeaderButton key={action.label} action={action} />
        ))}
      </View>
    </View>
  );
}

function HeaderButton({ action }: { action: ChatShellAction }) {
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      disabled={action.disabled}
      hitSlop={8}
      onPress={action.onPress}
      onPressIn={action.disabled ? undefined : hapticSelection}
      pressRetentionOffset={12}
      style={({ pressed }) => [
        styles.headerButton,
        action.disabled && styles.headerButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={action.icon} size={17} tintColor={Colors.dark.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    elevation: 4,
    flexDirection: "row",
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 6,
    zIndex: 4,
  },
  headerActions: {
    elevation: 6,
    flexDirection: "row",
    flexShrink: 0,
    gap: 10,
    zIndex: 6,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "rgba(42, 42, 42, 0.8)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    position: "relative",
    width: 36,
    zIndex: 7,
  },
  headerButtonDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
  },
  connectionBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    maxWidth: 132,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  connectionBadge_bad: {
    backgroundColor: "rgba(255, 111, 111, 0.12)",
  },
  connectionBadge_good: {
    backgroundColor: "rgba(111, 220, 140, 0.12)",
  },
  connectionBadge_muted: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  connectionBadge_warn: {
    backgroundColor: "rgba(248, 196, 109, 0.12)",
  },
  connectionDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  connectionDot_bad: {
    backgroundColor: "#FF7A7A",
  },
  connectionDot_good: {
    backgroundColor: "#6FDC8C",
  },
  connectionDot_muted: {
    backgroundColor: "rgba(255, 255, 255, 0.36)",
  },
  connectionDot_warn: {
    backgroundColor: "#F8C46D",
  },
  connectionLabel: {
    fontSize: 9,
    lineHeight: 12,
    maxWidth: 112,
  },
  subtitle: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
    maxWidth: "100%",
    opacity: 0.84,
    textAlign: "center",
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  titleGroup: {
    alignItems: "center",
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
