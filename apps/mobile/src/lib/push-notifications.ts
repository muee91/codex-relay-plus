import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { PushNotificationPreferences } from "codex-relay/api-schema";
import { Platform } from "react-native";

import { codexRelayStorage } from "./codex-relay-server-url-storage";

const initialPushNotificationRegistrationStorageKey =
  "codex-relay.initial-push-notification-registration-completed";

export const defaultPushNotificationPreferences: PushNotificationPreferences = {
  actionRequired: true,
  includeRemainingUsage: false,
  turnTerminal: true,
};

let foregroundNotificationHandlerConfigured = false;

export class PushNotificationPermissionDeniedError extends Error {
  constructor() {
    super("Notifications are not allowed for Codex Relay.");
    this.name = "PushNotificationPermissionDeniedError";
  }
}

export function configurePushNotificationPresentation() {
  if (!supportsPushNotifications() || foregroundNotificationHandlerConfigured) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  foregroundNotificationHandlerConfigured = true;
}

export function supportsPushNotifications() {
  return Platform.OS === "android" || Platform.OS === "ios";
}

export async function getExpoPushToken() {
  const platform = pushNotificationPlatform();
  if (platform === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Codex Relay",
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  const permissions =
    existingPermissions.status === "granted"
      ? existingPermissions
      : await Notifications.requestPermissionsAsync();
  if (permissions.status !== "granted") {
    throw new PushNotificationPermissionDeniedError();
  }

  const projectId = expoProjectId();
  if (!projectId) {
    throw new Error("This app build is missing its Expo project identifier.");
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export function hasCompletedInitialPushNotificationRegistration(hostId?: string) {
  return (
    codexRelayStorage.getBoolean(pushRegistrationStorageKey(hostId)) ??
    // Read the old device-wide flag only for the unscoped legacy session. A
    // saved Host must register independently after a multi-host upgrade.
    (hostId
      ? false
      : codexRelayStorage.getBoolean(initialPushNotificationRegistrationStorageKey)) ??
    false
  );
}

export function markInitialPushNotificationRegistrationCompleted(hostId?: string) {
  codexRelayStorage.set(pushRegistrationStorageKey(hostId), true);
}

export function notificationResponseThreadId(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const threadId = data?.threadId;
  return typeof threadId === "string" && threadId.trim() ? threadId : undefined;
}

export function notificationResponseHostId(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const hostId = data?.hostId;
  if (typeof hostId === "string" && hostId.trim()) {
    return hostId;
  }
  const serverPublicKey = data?.serverPublicKey;
  return typeof serverPublicKey === "string" && serverPublicKey.trim()
    ? `server:${serverPublicKey}`
    : undefined;
}

export function pushNotificationPlatform(): "android" | "ios" {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    return Platform.OS;
  }
  throw new Error("Push notifications are available only in the iOS and Android apps.");
}

function expoProjectId() {
  const easProjectId = Constants.easConfig?.projectId;
  if (typeof easProjectId === "string" && easProjectId.trim()) {
    return easProjectId;
  }
  const configProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof configProjectId === "string" && configProjectId.trim()
    ? configProjectId
    : undefined;
}

function pushRegistrationStorageKey(hostId: string | undefined) {
  return hostId
    ? `${initialPushNotificationRegistrationStorageKey}:${hostId}`
    : initialPushNotificationRegistrationStorageKey;
}
