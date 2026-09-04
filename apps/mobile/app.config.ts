import type { ConfigContext, ExpoConfig } from "expo/config";

function androidVersionCode() {
  const raw = process.env.CODEX_RELAY_ANDROID_VERSION_CODE?.trim();
  if (!raw) {
    return 1;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_100_000_000) {
    throw new Error(`Invalid CODEX_RELAY_ANDROID_VERSION_CODE: ${raw}`);
  }
  return value;
}

function androidVersionName() {
  const raw = process.env.CODEX_RELAY_ANDROID_VERSION_NAME?.trim();
  if (!raw) {
    return "1.4.0";
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[.-][0-9A-Za-z.-]+)?$/.test(raw)) {
    throw new Error(`Invalid CODEX_RELAY_ANDROID_VERSION_NAME: ${raw}`);
  }
  return raw;
}

export default function appConfig(_context: ConfigContext): ExpoConfig {
  const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
  return {
    name: "Codex Relay Plus",
    slug: "codex-relay",
    version: androidVersionName(),
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "codex-relay",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/images/icon.png",
      bundleIdentifier: "com.gronstudio.codexrelay",
      supportsTablet: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
        },
        ITSAppUsesNonExemptEncryption: false,
        NSLocalNetworkUsageDescription: isZhCn
          ? "Codex Relay 使用本地网络连接到你电脑上运行的 Relay。"
          : "Codex Relay uses the local network to connect this device to the Codex Relay server running on your computer.",
        "UISupportedInterfaceOrientations~ipad": [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight",
        ],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#191919",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.muee91.codexrelayplus",
      versionCode: androidVersionCode(),
      permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS"],
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-dev-client",
        {
          launchMode: "most-recent",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#191919",
          image: "./assets/images/splash-icon.png",
          imageWidth: 112,
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 112,
          },
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: isZhCn
            ? "Codex Relay 需要使用相机扫描 Mac 桌面端显示的连接二维码。"
            : "Codex Relay uses the camera to scan QR codes that contain your local relay server address, for example to connect this device to the Codex Relay server running on your computer.",
          microphonePermission: false,
          recordAudioAndroid: false,
          barcodeScannerEnabled: true,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: isZhCn
            ? "Codex Relay 需要访问照片，以便你在聊天中添加图片或截图。"
            : "Codex Relay uses photo library access so you can attach images to a Codex chat, for example to ask Codex to inspect a screenshot.",
          microphonePermission: false,
        },
      ],
      "expo-font",
      "expo-image",
      "expo-notifications",
      "expo-system-ui",
      "expo-web-browser",
      "@hot-updater/react-native",
      "./plugins/withBrotliDependencyResolution",
      "./plugins/withTailcatTransport",
      "react-native-enriched-markdown",
      [
        "expo-secure-store",
        {
          faceIDPermission: false,
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.4",
          },
          android: {
            usesCleartextTraffic: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "6659e28f-2ac7-4055-8f56-7b4ca5e65847",
      },
    },
  };
}
