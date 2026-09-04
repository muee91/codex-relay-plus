import { NativeModules, Platform } from "react-native";

export type TailcatPathStatus = {
  derpRegion?: string;
  endpoint?: string;
  error?: string;
  latencyMs?: number;
  path: "idle" | "connecting" | "direct" | "derp" | "offline";
};

type CodexRelayTransportNativeModule = {
  discoverLocalRelay(timeoutMs: number): Promise<string | null>;
  refreshTailcatPath(): Promise<string>;
  startTailcatProxy(serverAddr: string, remotePort: number): Promise<string>;
  stopTailcatProxy(): Promise<void>;
  tailcatStatus(): Promise<string>;
};

function nativeModule(): CodexRelayTransportNativeModule | undefined {
  if (Platform.OS !== "android") {
    return undefined;
  }
  return NativeModules.CodexRelayTransport as CodexRelayTransportNativeModule | undefined;
}

export function isNativeTailcatAvailable() {
  return Boolean(nativeModule());
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
