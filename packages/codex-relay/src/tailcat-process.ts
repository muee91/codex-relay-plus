import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { constants, rmSync } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface, type Interface } from "node:readline";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { codexRelayDataPath } from "./paths.js";

const defaultReadyWaitMs = 5_000;
const processExitWaitMs = 5_000;
const execFileAsync = promisify(execFile);

export type TailcatStartupInfo = {
  address: string;
  port: number;
};

export type ManagedTailcat = {
  readonly pid: number;
  readonly statusPath: string;
  readonly startupInfo: Promise<TailcatStartupInfo | undefined>;
  stop(): Promise<void>;
  stopNow(): void;
};

export type StartManagedTailcatOptions = {
  readonly binaryPath?: string;
  readonly keyPath?: string;
  readonly pidPath?: string;
  readonly port: number;
  readonly readyWaitMs?: number;
  readonly statusPath?: string;
};

export type StopManagedTailcatResult =
  | { readonly kind: "not-running" }
  | { readonly kind: "stopped"; readonly pid: number }
  | { readonly kind: "timed-out"; readonly pid: number };

type TailcatChildProcess = ChildProcessByStdio<null, Readable, null>;

type TailcatProcessOptions = StartManagedTailcatOptions & {
  readonly child: TailcatChildProcess;
  readonly pidPath: string;
  readonly statusPath: string;
};

export function tailcatKeyPath() {
  return codexRelayDataPath("tailcat-server.json");
}

export function tailcatPidPath() {
  return codexRelayDataPath("tailcat.pid");
}

export function tailcatStatusPath() {
  return codexRelayDataPath("tailcat-status.json");
}

export async function resolveTailcatBinary(configuredPath = process.env.CODEX_RELAY_TAILCAT_BIN) {
  const requestedPath = configuredPath?.trim();
  const candidates = requestedPath
    ? [requestedPath]
    : [
        codexRelayDataPath("tailcat-relay-server"),
        join(dirname(fileURLToPath(import.meta.url)), "tailcat-relay-server"),
        "tailcat-relay-server",
      ];

  for (const candidate of candidates) {
    const resolvedCandidate = await resolveExecutable(candidate);
    if (resolvedCandidate) return resolvedCandidate;
  }

  return undefined;
}

export async function startManagedTailcat(
  options: StartManagedTailcatOptions,
): Promise<ManagedTailcat> {
  if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error(`Invalid Tailcat Relay port: ${options.port}`);
  }

  const binaryPath = await resolveTailcatBinary(options.binaryPath);
  if (!binaryPath) {
    throw new Error(
      "Tailcat was requested, but tailcat-relay-server was not found. " +
        "Build it with scripts/build-linux-tailcat.sh or set CODEX_RELAY_TAILCAT_BIN.",
    );
  }

  const pidPath = options.pidPath ?? tailcatPidPath();
  const statusPath = options.statusPath ?? tailcatStatusPath();
  const keyPath = options.keyPath ?? tailcatKeyPath();
  await stopManagedTailcat({ pidPath, statusPath });
  await mkdir(dirname(keyPath), { recursive: true, mode: 0o700 });
  await rm(statusPath, { force: true });

  const child = spawnTailcat(binaryPath, ["--key", keyPath, "--port", String(options.port)]);
  if (!child.pid) {
    throw new Error(`Failed to start Tailcat helper: ${binaryPath}`);
  }

  process.env.CODEX_RELAY_TAILCAT_ENABLED = "1";
  process.env.CODEX_RELAY_TAILCAT_STATUS_FILE = statusPath;
  process.env.CODEX_RELAY_TAILCAT_PORT = String(options.port);
  delete process.env.CODEX_RELAY_TAILCAT_ADDR;

  const managed = new TailcatProcess({
    ...options,
    child,
    keyPath,
    pidPath,
    statusPath,
  });
  try {
    await writeFile(pidPath, `${child.pid}\n${binaryPath}\n`, { mode: 0o600 });
    const ready = await waitForInitialReadiness(
      managed.startupInfo,
      options.readyWaitMs ?? defaultReadyWaitMs,
    );
    if (!ready && isChildRunning(child)) {
      console.error("Tailcat remote transport is still starting; continuing with LAN Relay.");
    }
  } catch (error) {
    await managed.stop();
    throw error;
  }
  return managed;
}

export async function stopManagedTailcat(
  options: {
    readonly pidPath?: string;
    readonly statusPath?: string;
  } = {},
): Promise<StopManagedTailcatResult> {
  const pidPath = options.pidPath ?? tailcatPidPath();
  const statusPath = options.statusPath ?? tailcatStatusPath();
  const value = await readFile(pidPath, "utf8").catch(() => undefined);
  const pid = value ? Number(value.split(/\r?\n/, 1)[0]?.trim()) : NaN;
  const expectedBinaryPath = value?.split(/\r?\n/)[1]?.trim();
  if (!Number.isInteger(pid) || pid <= 0 || !isProcessAlive(pid)) {
    await cleanupTailcatFiles(pidPath, statusPath);
    return { kind: "not-running" };
  }

  const command = await readProcessCommand(pid);
  if (!command || !isTailcatProcessCommand(command, expectedBinaryPath)) {
    await cleanupTailcatFiles(pidPath, statusPath);
    return { kind: "not-running" };
  }

  signalProcess(pid, "SIGTERM");
  const stopped = await waitForProcessExit(pid);
  if (!stopped) {
    return { kind: "timed-out", pid };
  }

  await cleanupTailcatFiles(pidPath, statusPath);
  return { kind: "stopped", pid };
}

export function parseTailcatStartupInfo(value: string): TailcatStartupInfo | undefined {
  try {
    const parsed = JSON.parse(value) as { address?: unknown; port?: unknown };
    if (
      typeof parsed.address !== "string" ||
      !parsed.address.startsWith("tc") ||
      typeof parsed.port !== "number" ||
      !Number.isSafeInteger(parsed.port) ||
      parsed.port < 1 ||
      parsed.port > 65535
    ) {
      return undefined;
    }
    return { address: parsed.address, port: parsed.port };
  } catch {
    return undefined;
  }
}

class TailcatProcess implements ManagedTailcat {
  readonly pid: number;
  readonly statusPath: string;
  readonly startupInfo: Promise<TailcatStartupInfo | undefined>;

  private readonly child: TailcatChildProcess;
  private readonly pidPath: string;
  private readonly lines: Interface;
  private readyInfo: TailcatStartupInfo | undefined;
  private readySettled = false;
  private statusWrite: Promise<void> | undefined;
  private resolveReady!: (value: TailcatStartupInfo | undefined) => void;
  private readonly signalHandlers: {
    readonly sigint: () => void;
    readonly sigterm: () => void;
    readonly exit: () => void;
  };

  constructor(options: TailcatProcessOptions) {
    this.child = options.child;
    this.pid = options.child.pid ?? 0;
    this.pidPath = options.pidPath;
    this.statusPath = options.statusPath;
    this.lines = createInterface({ input: options.child.stdout });
    this.startupInfo = new Promise((resolveReady) => {
      this.resolveReady = resolveReady;
    });
    this.signalHandlers = {
      sigint: () => {
        this.stopNow();
        process.exit(130);
      },
      sigterm: () => {
        this.stopNow();
        process.exit(143);
      },
      exit: () => this.stopNow(),
    };

    process.once("SIGINT", this.signalHandlers.sigint);
    process.once("SIGTERM", this.signalHandlers.sigterm);
    process.once("exit", this.signalHandlers.exit);
    this.lines.on("line", (line) => {
      const info = parseTailcatStartupInfo(line);
      if (info) void this.handleStartupInfo(info);
    });
    this.child.once("error", (error) => {
      if (!this.readySettled) this.resolveStartup(undefined);
      console.error(`Tailcat helper failed: ${error.message}`);
    });
    this.child.once("exit", () => {
      this.lines.close();
      if (!this.readySettled) this.resolveStartup(undefined);
      void cleanupTailcatFiles(this.pidPath, this.statusPath);
    });
  }

  async stop() {
    this.detachProcessHandlers();
    if (isChildRunning(this.child)) {
      try {
        this.child.kill("SIGTERM");
      } catch {
        // The child may have exited between the liveness check and kill.
      }
      if (!(await waitForChildExit(this.child))) {
        try {
          this.child.kill("SIGKILL");
        } catch {
          // The child may have exited while the forced cleanup was starting.
        }
        await waitForChildExit(this.child);
      }
    }
    await this.statusWrite?.catch(() => undefined);
    await cleanupTailcatFiles(this.pidPath, this.statusPath);
  }

  stopNow() {
    if (isChildRunning(this.child)) {
      try {
        this.child.kill("SIGTERM");
      } catch {
        // The child may have exited while the parent was shutting down.
      }
    }
    for (const path of [this.pidPath, this.statusPath, `${this.statusPath}.tmp`]) {
      rmSync(path, { force: true });
    }
  }

  private async handleStartupInfo(info: TailcatStartupInfo) {
    if (this.readyInfo) return;
    this.readyInfo = info;
    this.statusWrite = writeTailcatStatus(this.statusPath, info).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not write Tailcat status: ${message}`);
    });
    await this.statusWrite;
    this.resolveStartup(info);
  }

  private resolveStartup(info: TailcatStartupInfo | undefined) {
    if (this.readySettled) return;
    this.readySettled = true;
    this.resolveReady(info);
  }

  private detachProcessHandlers() {
    process.off("SIGINT", this.signalHandlers.sigint);
    process.off("SIGTERM", this.signalHandlers.sigterm);
    process.off("exit", this.signalHandlers.exit);
  }
}

function spawnTailcat(binaryPath: string, args: string[]) {
  return spawn(binaryPath, args, {
    stdio: ["ignore", "pipe", "inherit"],
  }) as unknown as TailcatChildProcess;
}

async function resolveExecutable(value: string) {
  const expanded = value.startsWith("~/") ? join(process.env.HOME ?? "", value.slice(2)) : value;
  if (expanded.includes("/")) {
    const candidate = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
    return (await isExecutable(candidate)) ? candidate : undefined;
  }

  for (const directory of (process.env.PATH ?? "").split(":").filter(Boolean)) {
    const candidate = join(directory, expanded);
    if (await isExecutable(candidate)) return candidate;
  }
  return undefined;
}

async function isExecutable(path: string) {
  return access(path, constants.X_OK).then(
    () => true,
    () => false,
  );
}

async function writeTailcatStatus(path: string, info: TailcatStartupInfo) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(info)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

async function cleanupTailcatFiles(pidPath: string, statusPath: string) {
  await Promise.all([
    rm(pidPath, { force: true }),
    rm(statusPath, { force: true }),
    rm(`${statusPath}.tmp`, { force: true }),
  ]);
}

function isChildRunning(child: TailcatChildProcess) {
  return child.exitCode === null && child.signalCode === null;
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function signalProcess(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return;
    throw error;
  }
}

async function waitForChildExit(child: TailcatChildProcess) {
  if (!isChildRunning(child)) return true;
  return new Promise<boolean>((resolveReady) => {
    const timer = globalThis.setTimeout(() => {
      child.removeListener("exit", onExit);
      resolveReady(false);
    }, processExitWaitMs);
    const onExit = () => {
      globalThis.clearTimeout(timer);
      resolveReady(true);
    };
    child.once("exit", onExit);
  });
}

async function waitForInitialReadiness(
  startupInfo: Promise<TailcatStartupInfo | undefined>,
  timeoutMs: number,
) {
  return new Promise<TailcatStartupInfo | undefined>((resolveReady) => {
    const timer = globalThis.setTimeout(() => {
      resolveReady(undefined);
    }, timeoutMs);
    startupInfo.then(
      (info) => {
        globalThis.clearTimeout(timer);
        resolveReady(info);
      },
      () => {
        globalThis.clearTimeout(timer);
        resolveReady(undefined);
      },
    );
  });
}

async function waitForProcessExit(pid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!isProcessAlive(pid)) return true;
    await delay(50);
  }
  return false;
}

async function readProcessCommand(pid: number) {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

function isTailcatProcessCommand(command: string, expectedBinaryPath?: string) {
  const normalized = command.replaceAll("\\", "/");
  const expectedBinary = expectedBinaryPath
    ? basename(expectedBinaryPath).replaceAll("\\", "/")
    : "";
  return (
    (normalized.includes("tailcat-relay-server") ||
      (expectedBinary.length > 0 && normalized.includes(expectedBinary))) &&
    normalized.includes(" --key ") &&
    normalized.includes(" --port ")
  );
}
