import { NativeModules, Platform } from "react-native";

export type TailcatPathStatus = {
  derpRegion?: string;
  endpoint?: string;
  error?: string;
  latencyMs?: number;
  path: "idle" | "lan" | "connecting" | "direct" | "derp" | "offline";
};

type CodexRelayTransportNativeModule = {
  configureRelayProxy(
    serverAddr: string,
    remotePort: number,
    lanTargetsJson: string,
    mode: "auto" | "local" | "remote",
  ): Promise<string>;
  configureRelayProxySync(
    serverAddr: string,
    remotePort: number,
    lanTargetsJson: string,
    mode: "auto" | "local" | "remote",
  ): string;
  discoverLocalRelay(timeoutMs: number): Promise<string | null>;
  getPersistedRelayProxyConfig?(): string | null;
  refreshTailcatPath(): Promise<string>;
  startTailcatProxy(serverAddr: string, remotePort: number): Promise<string>;
  stopTailcatProxy(): Promise<void>;
  tailcatStatus(): Promise<string>;
};

export type NativeRelayProxyConfig = {
  serverAddr: string;
  remotePort: number;
};

// Accessing NativeModules here eagerly instantiates the mobile bridge. Both the
// Android and iOS implementations restore the fixed-port proxy from native
// storage so a previously selected remote route is available before API traffic.
const nativeTransport =
  Platform.OS === "android" || Platform.OS === "ios"
    ? (NativeModules.CodexRelayTransport as CodexRelayTransportNativeModule | undefined)
    : undefined;

function nativeModule() {
  return nativeTransport;
}

export function isNativeTailcatAvailable() {
  return Boolean(nativeModule());
}

export function getPersistedNativeRelayProxyConfig(): NativeRelayProxyConfig | undefined {
  const raw = nativeModule()?.getPersistedRelayProxyConfig?.();
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<NativeRelayProxyConfig>;
    if (
      typeof parsed.serverAddr !== "string" ||
      !parsed.serverAddr.startsWith("tc") ||
      typeof parsed.remotePort !== "number" ||
      !Number.isSafeInteger(parsed.remotePort) ||
      parsed.remotePort < 1 ||
      parsed.remotePort > 65535
    ) {
      return undefined;
    }
    return { serverAddr: parsed.serverAddr, remotePort: parsed.remotePort };
  } catch {
    return undefined;
  }
}

export async function configureNativeRelayProxy(input: {
  lanTargets: string[];
  mode: "auto" | "local" | "remote";
  remotePort: number;
  serverAddr: string;
}) {
  const module = nativeModule();
  if (!module) {
    throw new Error("Tailcat transport is not available in this build.");
  }
  return module.configureRelayProxy(
    input.serverAddr,
    input.remotePort,
    JSON.stringify(input.lanTargets),
    input.mode,
  );
}

export function configureNativeRelayProxySync(input: {
  lanTargets: string[];
  mode: "auto" | "local" | "remote";
  remotePort: number;
  serverAddr: string;
}) {
  const module = nativeModule();
  if (!module?.configureRelayProxySync) {
    throw new Error("Tailcat transport is not available in this build.");
  }
  return module.configureRelayProxySync(
    input.serverAddr,
    input.remotePort,
    JSON.stringify(input.lanTargets),
    input.mode,
  );
}

export async function startNativeTailcatProxy(serverAddr: string, remotePort: number) {
  const module = nativeModule();
  if (!module) {
    throw new Error("Tailcat transport is not available in this build.");
  }
  return module.startTailcatProxy(serverAddr, remotePort);
}

export async function stopNativeTailcatProxy() {
  await nativeModule()?.stopTailcatProxy();
}

export async function refreshNativeTailcatPath(): Promise<TailcatPathStatus> {
  const module = nativeModule();
  if (!module) {
    return { path: "idle" };
  }
  return parseStatus(await module.refreshTailcatPath());
}

export async function getNativeTailcatStatus(): Promise<TailcatPathStatus> {
  const module = nativeModule();
  if (!module) {
    return { path: "idle" };
  }
  return parseStatus(await module.tailcatStatus());
}

export async function discoverNativeLocalRelay(timeoutMs = 1200) {
  return nativeModule()?.discoverLocalRelay(timeoutMs) ?? null;
}

function parseStatus(value: string): TailcatPathStatus {
  try {
    const parsed = JSON.parse(value) as TailcatPathStatus;
    return parsed && typeof parsed.path === "string" ? parsed : { path: "offline" };
  } catch {
    return { path: "offline", error: "Tailcat returned invalid path status." };
  }
}
