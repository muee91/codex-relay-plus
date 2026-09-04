import { vi } from "vitest";

type StoredValue = boolean | number | string;

const stores = new Map<string, Map<string, StoredValue>>();

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
      getNumber(key: string) {
        const value = store.get(key);
        return typeof value === "number" ? value : undefined;
      },
      getString(key: string) {
        const value = store.get(key);
        return typeof value === "string" ? value : undefined;
      },
      remove(key: string) {
        store.delete(key);
      },
      set(key: string, value: StoredValue) {
        store.set(key, value);
      },
    };
  },
}));
