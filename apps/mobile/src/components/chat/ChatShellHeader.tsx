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

type ChatActivityTone = "active" | "attention" | "idle";

export function ChatShellHeader({
  activityLabel,
  activityTone,
  leadingAction,
  subtitle,
  title,
  trailingActions,
}: {
  activityLabel: string;
  activityTone: ChatActivityTone;
  leadingAction: ChatShellAction;
  subtitle: string;
  title: string;
  trailingActions: readonly ChatShellAction[];
}) {
  return (
    <View pointerEvents="box-none" style={styles.header}>
      <HeaderButton action={leadingAction} />
      <View pointerEvents="none" style={styles.titleGroup}>
        <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.activityDot,
              activityTone === "active" && styles.activityDotActive,
              activityTone === "attention" && styles.activityDotAttention,
            ]}
          />
          <ThemedText type="code" themeColor="textSecondary" style={styles.activityLabel}>
            {activityLabel}
          </ThemedText>
          <View style={styles.metaDivider} />
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
        pressed && styles.headerButtonPressed,
      ]}
    >
      <Icon name={action.icon} size={17} tintColor={Colors.dark.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 5,
    zIndex: 4,
  },
  headerActions: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 4,
  },
  headerButton: {
    alignItems: "center",
    borderRadius: 9,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    opacity: 0.76,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  titleGroup: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 2,
    minWidth: 0,
  },
  activityDot: {
    backgroundColor: "#777C79",
    borderRadius: 3,
    height: 6,
    marginRight: 5,
    width: 6,
  },
  activityDotActive: {
    backgroundColor: "#7DD3A6",
  },
  activityDotAttention: {
    backgroundColor: "#D9B867",
  },
  activityLabel: {
    flexShrink: 0,
    fontSize: 9,
    lineHeight: 12,
  },
  metaDivider: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    height: 9,
    marginHorizontal: 7,
    width: StyleSheet.hairlineWidth,
  },
  subtitle: {
    flex: 1,
    fontSize: 9,
    lineHeight: 12,
    minWidth: 0,
    opacity: 0.76,
  },
});
