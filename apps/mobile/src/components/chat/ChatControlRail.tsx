import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Icon, type AppIconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Fonts } from "@/constants/theme";

import type { RuntimePickerOption } from "./RuntimeModeSheet";

export function ChatControlRail({
  isFastModeEnabled,
  modelDisabled,
  modelLabel,
  onModelPress,
  onRuntimePress,
  runtimeOption,
}: {
  isFastModeEnabled: boolean;
  modelDisabled: boolean;
  modelLabel: string;
  onModelPress: () => void;
  onRuntimePress: () => void;
  runtimeOption: RuntimePickerOption;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.controlRail}>
        <ControlStatusButton
          accessibilityLabel={`Runtime mode ${runtimeOption.compactLabel}`}
          icon={runtimeOption.icon}
          label={runtimeOption.compactLabel}
          onPress={onRuntimePress}
          style={styles.runtimeButton}
          tintColor={runtimeOption.iconTintColor}
        />
        <View style={styles.divider} />
        <ControlStatusButton
          accessibilityLabel={`Model ${modelLabel}`}
          disabled={modelDisabled}
          icon={isFastModeEnabled ? "fast" : undefined}
          label={modelLabel}
          onPress={onModelPress}
          style={styles.modelButton}
          tintColor={isFastModeEnabled ? "rgba(255, 218, 117, 0.9)" : undefined}
        />
      </View>
    </View>
  );
}

function ControlStatusButton({
  accessibilityLabel,
  disabled,
  icon,
  label,
  onPress,
  style,
  tintColor = "rgba(243, 244, 246, 0.68)",
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon?: AppIconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
}) {
  return (
    <Pressable
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.controlTouchTarget, style, disabled ? styles.buttonDisabled : null]}
    >
      {({ pressed }) => (
        <View style={[styles.controlButton, pressed ? styles.pressed : null]}>
          {icon ? (
            <View style={styles.controlButtonIconSlot}>
              <Icon name={icon} size={11} strokeWidth={1.8} tintColor={tintColor} />
            </View>
          ) : null}
          <Text numberOfLines={1} style={[styles.controlButtonLabel, { color: tintColor }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  controlRail: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    justifyContent: "flex-start",
    minWidth: 0,
    width: "100%",
  },
  controlTouchTarget: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
  },
  controlButton: {
    alignItems: "center",
    borderRadius: 7,
    flexDirection: "row",
    gap: 4,
    height: 28,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  runtimeButton: {
    flexShrink: 0,
  },
  modelButton: {
    flexShrink: 1,
    maxWidth: "68%",
    minWidth: 0,
    overflow: "hidden",
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  controlButtonIconSlot: {
    alignItems: "center",
    height: 12,
    justifyContent: "center",
    width: 12,
  },
  controlButtonLabel: {
    flexShrink: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    lineHeight: 13,
    minWidth: 0,
  },
  divider: {
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    height: 12,
    marginHorizontal: 2,
    width: StyleSheet.hairlineWidth,
  },
  pressed: {
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    opacity: 0.76,
  },
});
