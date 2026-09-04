import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type TailcatNativeModule = {
  currentProxyUrl(): string;
  startProxy(address: string, remotePort: number): Promise<string>;
  stopProxy(): void;
  version(): string;
};

let module: TailcatNativeModule | undefined;

function nativeModule() {
  if (Platform.OS !== "android") {
    return undefined;
  }
  module ??= requireNativeModule<TailcatNativeModule>("CodexRelayTailcat");
  return module;
}

export async function startTailcatProxy(address: string, remotePort: number) {
  const native = nativeModule();
  if (!native) {
    throw new Error("Tailcat transport is available only in the Android native build.");
  }
  return native.startProxy(address, remotePort);
}

export function stopTailcatProxy() {
  nativeModule()?.stopProxy();
}

export function currentTailcatProxyUrl() {
  return nativeModule()?.currentProxyUrl() || undefined;
}

export function tailcatNativeVersion() {
  return nativeModule()?.version();
}
