import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseTailcatStartupInfo, startManagedTailcat } from "../src/tailcat-process.js";

const tailcatEnvKeys = [
  "CODEX_RELAY_TAILCAT_ADDR",
  "CODEX_RELAY_TAILCAT_ENABLED",
  "CODEX_RELAY_TAILCAT_PORT",
  "CODEX_RELAY_TAILCAT_STATUS_FILE",
] as const;
const originalTailcatEnv = Object.fromEntries(
  tailcatEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof tailcatEnvKeys)[number], string | undefined>;

afterEach(() => {
  for (const key of tailcatEnvKeys) {
    const value = originalTailcatEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Tailcat CLI process management", () => {
  it("parses only valid Tailcat startup records", () => {
    expect(parseTailcatStartupInfo('{"address":"tcExample","port":8787}')).toEqual({
      address: "tcExample",
      port: 8787,
    });
    expect(parseTailcatStartupInfo("not json")).toBeUndefined();
    expect(parseTailcatStartupInfo('{"address":"http://127.0.0.1","port":8787}')).toBeUndefined();
    expect(parseTailcatStartupInfo('{"address":"tcExample","port":"8787"}')).toBeUndefined();
  });

  it("starts a helper, publishes its status, and stops it with the relay", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-relay-tailcat-"));
    const binaryPath = join(directory, "tailcat-relay-server");
    const keyPath = join(directory, "tailcat-server.json");
    const pidPath = join(directory, "tailcat.pid");
    const statusPath = join(directory, "tailcat-status.json");
    await writeFile(
      binaryPath,
      [
        "#!/usr/bin/env node",
        "const args = process.argv;",
        "const port = Number(args[args.indexOf('--port') + 1]);",
        "console.log(JSON.stringify({ address: 'tcTestNode', port }));",
        "process.on('SIGTERM', () => process.exit(0));",
        "setInterval(() => {}, 1000);",
        "",
      ].join("\n"),
      { mode: 0o700 },
    );
    await chmod(binaryPath, 0o700);

    const managed = await startManagedTailcat({
      binaryPath,
      keyPath,
      pidPath,
      port: 8787,
      readyWaitMs: 2_000,
      statusPath,
    });

    expect(await managed.startupInfo).toEqual({ address: "tcTestNode", port: 8787 });
    expect(JSON.parse(await readFile(statusPath, "utf8"))).toEqual({
      address: "tcTestNode",
      port: 8787,
    });
    expect((await readFile(pidPath, "utf8")).split(/\r?\n/)[0]).toBe(String(managed.pid));

    await managed.stop();
    await expect(readFile(pidPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(statusPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await rm(directory, { recursive: true, force: true });
  });
});
