import { createMMKV } from "react-native-mmkv";

export const hostStorage = createMMKV({ id: "codex-relay-hosts" });
const activeHostIdStorageKey = "active-host-id-v1";

export function getActiveCodexRelayHostId() {
  return hostStorage.getString(activeHostIdStorageKey);
}

export function setActiveCodexRelayHostId(id: string | undefined) {
  if (id) {
    hostStorage.set(activeHostIdStorageKey, id);
  } else {
    hostStorage.remove(activeHostIdStorageKey);
  }
}
