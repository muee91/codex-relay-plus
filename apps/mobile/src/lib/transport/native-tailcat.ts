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
  discoverLocalRelay(timeoutMs: number): Promise<string | null>;
  refreshTailcatPath(): Promise<string>;
  startTailcatProxy(serverAddr: string, remotePort: number): Promise<string>;
  stopTailcatProxy(): Promise<void>;
  tailcatStatus(): Promise<string>;
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
