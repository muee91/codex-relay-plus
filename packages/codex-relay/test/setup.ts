import { vi } from "vitest";

const stores = new Map<string, Map<string, boolean | string>>();

vi.mock("react-native-mmkv", () => ({
  createMMKV(options?: { id?: string }) {
    const id = options?.id ?? "default";
    let store = stores.get(id);
    if (!store) {
      store = new Map();
      stores.set(id, store);
    }

    return {
      getBoolean(key: string) {
        const value = store.get(key);
        return typeof value === "boolean" ? value : undefined;
      },
      getString(key: string) {
        const value = store.get(key);
        return typeof value === "string" ? value : undefined;
      },
      remove(key: string) {
        store.delete(key);
      },
      set(key: string, value: boolean | string) {
        store.set(key, value);
      },
    };
  },
}));
