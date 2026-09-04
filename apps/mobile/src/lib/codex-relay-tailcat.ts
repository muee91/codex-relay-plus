import { Platform } from "react-native";

import {
  currentTailcatProxyUrl,
  startTailcatProxy,
  stopTailcatProxy,
} from "../../modules/codex-relay-tailcat";
import { codexRelayStorage } from "./codex-relay-server-url-storage";

const tailcatAddressStorageKey = "codex-relay.tailcat-address";
const tailcatPortStorageKey = "codex-relay.tailcat-port";

export type CodexRelayTailcatConnection = {
  address: string;
  port: number;
};

export function saveCodexRelayTailcatConnection(connection: CodexRelayTailcatConnection) {
  codexRelayStorage.set(tailcatAddressStorageKey, connection.address);
  codexRelayStorage.set(tailcatPortStorageKey, connection.port);
}

export function getCodexRelayTailcatConnection(): CodexRelayTailcatConnection | undefined {
  const address = codexRelayStorage.getString(tailcatAddressStorageKey)?.trim();
  const port = codexRelayStorage.getNumber(tailcatPortStorageKey);
  if (!address?.startsWith("tc") || !port || port < 1 || port > 65535) {
    return undefined;
  }
  return { address, port };
}

export async function restartCodexRelayTailcatProxy() {
  const connection = getCodexRelayTailcatConnection();
  if (!connection) {
    throw new Error("This paired computer has no Tailcat remote address.");
  }
  if (Platform.OS !== "android") {
    throw new Error("Embedded Tailcat remote transport is currently available on Android.");
  }
  stopTailcatProxy();
  return startTailcatProxy(connection.address, connection.port);
}

export function currentCodexRelayTailcatProxyUrl() {
  return currentTailcatProxyUrl();
}

export function clearCodexRelayTailcatConnection() {
  codexRelayStorage.remove(tailcatAddressStorageKey);
  codexRelayStorage.remove(tailcatPortStorageKey);
  stopTailcatProxy();
}
