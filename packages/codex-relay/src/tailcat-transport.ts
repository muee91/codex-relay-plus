import { execFile, spawn, type ChildProcess } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const tailcatStartupTimeoutMs = 20_000;

export type TailcatServerState = {
  address?: string;
  available: boolean;
  error?: string;
  version: "v0.5.0";
};

export type TailcatServerOptions = {
  binaryPath?: string;
  keyPath?: string;
  onChange?: (state: TailcatServerState) => void;
  port: number;
};

export class TailcatServerTransport {
  private address: string | undefined;
  private child: ChildProcess | undefined;
  private closed = false;
  private error: string | undefined;
  private restartTimer: NodeJS.Timeout | undefined;
  private starting: Promise<void> | undefined;

  constructor(private readonly options: TailcatServerOptions) {}

  getState(): TailcatServerState {
    return {
      address: this.address,
      available: Boolean(this.address && this.child && !this.child.killed),
      error: this.error,
      version: "v0.5.0",
    };
  }

  start() {
    if (!this.starting) {
      this.starting = this.startOnce().finally(() => {
        this.starting = undefined;
      });
    }
    return this.starting;
  }

  stop() {
    this.closed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }
    const child = this.child;
    this.child = undefined;
    this.address = undefined;
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
    this.emit();
  }

  private async startOnce() {
    if (this.closed || this.child) {
      return;
    }
    const binaryPath = this.options.binaryPath?.trim();
    const keyPath = this.options.keyPath?.trim();
    if (!binaryPath || !keyPath) {
      this.error = "Tailcat runtime is not bundled in this build.";
      this.emit();
      return;
    }

    try {
      await access(binaryPath);
      await mkdir(dirname(keyPath), { recursive: true });
      await this.ensureKey(binaryPath, keyPath);
      if (this.closed) {
        return;
      }
      await this.spawnServer(binaryPath, keyPath);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.address = undefined;
      this.emit();
      this.scheduleRestart();
    }
  }

  private async ensureKey(binaryPath: string, keyPath: string) {
    try {
      await access(keyPath);
      return;
    } catch {
      // First start: create a persistent key and pin the selected DERP region.
    }
    await execFileAsync(binaryPath, ["genkey", `--key=${keyPath}`, "--fixed-region"], {
      timeout: tailcatStartupTimeoutMs,
      windowsHide: true,
    });
  }

  private async spawnServer(binaryPath: string, keyPath: string) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        binaryPath,
        ["--json", `--key=${keyPath}`, "serve", String(this.options.port)],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      this.child = child;
      let stdout = "";
      let stderr = "";
      let settled = false;
      const startupTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          reject(new Error("Tailcat did not publish a connection address in time."));
        }
      }, tailcatStartupTimeoutMs);

      const finishStartup = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(startupTimer);
        error ? reject(error) : resolve();
      };

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        const lines = stdout.split(/\r?\n/);
        stdout = lines.pop() ?? "";
        for (const line of lines) {
          const address = parseTailcatListenAddress(line);
          if (!address) {
            continue;
          }
          this.address = address;
          this.error = undefined;
          this.emit();
          finishStartup();
          break;
        }
      });
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-4000);
      });
      child.once("error", (error) => finishStartup(error));
      child.once("exit", (code, signal) => {
        clearTimeout(startupTimer);
        if (this.child === child) {
          this.child = undefined;
          this.address = undefined;
          const detail = sanitizeTailcatError(stderr);
          this.error = detail || `Tailcat exited (${signal ?? code ?? "unknown"}).`;
          this.emit();
          this.scheduleRestart();
        }
        if (!settled) {
          finishStartup(new Error(this.error ?? "Tailcat exited during startup."));
        }
      });
    });
  }

  private scheduleRestart() {
    if (this.closed || this.restartTimer || !this.options.binaryPath || !this.options.keyPath) {
      return;
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined;
      void this.start();
    }, 5000);
    this.restartTimer.unref?.();
  }

  private emit() {
    this.options.onChange?.(this.getState());
  }
}

export function parseTailcatListenAddress(line: string) {
  try {
    const parsed = JSON.parse(line) as { listenAddr?: unknown };
    const value = typeof parsed.listenAddr === "string" ? parsed.listenAddr.trim() : "";
    return value.startsWith("tc") ? value : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeTailcatError(value: string) {
  return value
    .replace(/tc[A-Za-z0-9_-]{20,}/g, "[tailcat-address-redacted]")
    .trim()
    .slice(-800);
}
