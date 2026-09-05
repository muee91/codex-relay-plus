import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packagePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "codex-relay/api-schema": packagePath("./src/api-schema.ts"),
      "react-native": packagePath("./test/react-native.mock.ts"),
    },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
