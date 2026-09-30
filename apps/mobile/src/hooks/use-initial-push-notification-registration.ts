import { useSelector } from "@legendapp/state/react";
import { useEffect, useRef } from "react";

import { getPushNotificationSettings, registerPushNotifications } from "@/lib/codex-relay-api";
import {
  defaultPushNotificationPreferences,
  getExpoPushToken,
  hasCompletedInitialPushNotificationRegistration,
  markInitialPushNotificationRegistrationCompleted,
  PushNotificationPermissionDeniedError,
  pushNotificationPlatform,
  supportsPushNotifications,
} from "@/lib/push-notifications";
import { chatStore$ } from "@/state/chat-store";

export function useInitialPushNotificationRegistration() {
  const activeHostId = useSelector(() => chatStore$.activeHostId.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const registrationStartedRef = useRef(new Set<string>());
  const registrationKey = activeHostId ?? "unpaired";

  useEffect(() => {
    if (
      !hasPairedSession ||
      registrationStartedRef.current.has(registrationKey) ||
      !supportsPushNotifications() ||
      hasCompletedInitialPushNotificationRegistration(activeHostId)
    ) {
      return;
    }

    registrationStartedRef.current.add(registrationKey);
    void registerInitialPushNotifications(activeHostId);
  }, [activeHostId, hasPairedSession, registrationKey]);
}

async function registerInitialPushNotifications(hostId: string | undefined) {
  try {
    const currentSettings = await getPushNotificationSettings();
    if (currentSettings.registered) {
      markInitialPushNotificationRegistrationCompleted(hostId);
      return;
    }

    await registerPushNotifications({
      expoPushToken: await getExpoPushToken(),
      platform: pushNotificationPlatform(),
      preferences: defaultPushNotificationPreferences,
    });
    markInitialPushNotificationRegistrationCompleted(hostId);
  } catch (error) {
    if (error instanceof PushNotificationPermissionDeniedError) {
      markInitialPushNotificationRegistrationCompleted(hostId);
    }
  }
}
