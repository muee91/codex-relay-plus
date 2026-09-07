import "@/global.css";
import "expo-dev-client";
import "react-native-gesture-handler";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useSelector } from "@legendapp/state/react";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { useInitialPushNotificationRegistration } from "@/hooks/use-initial-push-notification-registration";
import {
  reconcileCodexRelayConnection,
  teardownCodexRelayNativeTransport,
} from "@/lib/codex-relay-connection-manager";
import {
  configurePushNotificationPresentation,
  notificationResponseThreadId,
  supportsPushNotifications,
} from "@/lib/push-notifications";
import { hasCodexRelaySession } from "@/lib/codex-relay-api";
import {
  persistedQueryMaxAgeMs,
  queryClientPersister,
  shouldPersistQuery,
} from "@/lib/query-persistence";
import { setStatusState } from "@/lib/server-state";
import { restoreChatStoreFromQueryCache } from "@/lib/server-state-hydration";
import { chatStore$, setActiveThread, setConnection, setServerUrl } from "@/state/chat-store";

void SplashScreen.preventAutoHideAsync();
configurePushNotificationPresentation();

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#191919",
    border: "rgba(255, 255, 255, 0.08)",
    card: "#202222",
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      retry: 1,
      staleTime: 0,
    },
  },
});

const TextWithDefaults = Text as typeof Text & {
  defaultProps?: Partial<React.ComponentProps<typeof Text>>;
};
const TextInputWithDefaults = TextInput as typeof TextInput & {
  defaultProps?: Partial<React.ComponentProps<typeof TextInput>>;
};

TextWithDefaults.defaultProps = {
  ...TextWithDefaults.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
};

TextInputWithDefaults.defaultProps = {
  ...TextInputWithDefaults.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
};

function TabLayout() {
  useInitialPushNotificationRegistration();
  const connection = useSelector(() => chatStore$.connection.get());
  const hasPairedSession = useSelector(() => chatStore$.hasPairedSession.get());
  const hasStoredPairedSession = hasCodexRelaySession();
  const [fontsLoaded] = useFonts({
    GeistMono: require("../../assets/fonts/GeistMono-Regular.ttf"),
    "GeistMono-Medium": require("../../assets/fonts/GeistMono-Medium.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!hasPairedSession) {
      // Native transport restores its persisted proxy before React hydration.
      // Do not tear it down during the brief window before ChatScreen mirrors
      // the stored pairing token into the observable state.
      if (!hasStoredPairedSession) {
        void teardownCodexRelayNativeTransport();
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      let attempt = 0;
      while (!cancelled && chatStore$.hasPairedSession.peek()) {
        if (attempt > 0) {
          const delayMs = Math.min(1000 * 2 ** Math.min(attempt, 4), 15_000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (cancelled) {
            return;
          }
        }

        try {
          const reconciled = await reconcileCodexRelayConnection();
          if (cancelled) {
            return;
          }
          setServerUrl(reconciled.serverUrl);
          setStatusState(queryClient, reconciled.status);
          setConnection("connected");
          void queryClient.invalidateQueries();
          return;
        } catch (error) {
          if (cancelled) {
            return;
          }
          setConnection(
            "offline",
            error instanceof Error ? error.message : "Could not reconnect to Codex Relay.",
          );
          attempt += 1;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, hasPairedSession, hasStoredPairedSession]);

  useEffect(() => {
    if (!supportsPushNotifications()) {
      return;
    }
    const openNotificationThread = (response: Notifications.NotificationResponse) => {
      const threadId = notificationResponseThreadId(response);
      if (!threadId) {
        return;
      }
      setActiveThread(threadId);
      router.replace("/");
      Notifications.clearLastNotificationResponse();
    };

    const mostRecentResponse = Notifications.getLastNotificationResponse();
    if (mostRecentResponse) {
      openNotificationThread(mostRecentResponse);
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotificationThread);
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={() => restoreChatStoreFromQueryCache(queryClient)}
      persistOptions={{
        buster: "codex-relay-server-state-v2",
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
        maxAge: persistedQueryMaxAgeMs,
        persister: queryClientPersister,
      }}
    >
      <ThemeProvider value={appTheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <BottomSheetModalProvider>
              <AnimatedSplashOverlay />
              <Stack
                screenOptions={{
                  contentStyle: {
                    backgroundColor: "#191919",
                  },
                  headerShown: false,
                }}
              >
                <Stack.Screen name="(drawer)" />
                <Stack.Screen name="pair" />
                <Stack.Screen
                  name="image-viewer"
                  options={{
                    contentStyle: {
                      backgroundColor: "#050505",
                    },
                    gestureEnabled: true,
                    presentation: "modal",
                  }}
                />
                <Stack.Screen
                  name="settings"
                  options={{
                    animation: "slide_from_right",
                    title: "Settings",
                  }}
                />
                <Stack.Screen
                  name="workspace-file-editor"
                  options={{
                    animation: "slide_from_right",
                    title: "File Editor",
                  }}
                />
              </Stack>
              <PortalHost />
            </BottomSheetModalProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

export default TabLayout;
