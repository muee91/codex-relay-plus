import { execFile } from "node:child_process";

import {
  createPairingQrPayload,
  getConnectUrlCandidates,
  isTailscaleStatusRunning,
  networkInterfaceFingerprint,
  type ConnectUrlCandidate,
  type TailscaleSnapshot,
  type TailscaleStatus,
} from "./pairing-url-candidates.js";

const lanPollIntervalMs = 5_000;
const tailscalePollIntervalMs = 30_000;
const tailscaleCommandTimeoutMs = 2_000;

export type NetworkStateSnapshot = {
  connectUrl: string;
  connectUrlCandidates: ConnectUrlCandidate[];
  pairingPayload: string;
  tailscale: TailscaleSnapshot;
  updatedAt: number;
};

type NetworkStateManagerOptions = {
  listenUrl: string;
  port: number;
  serverPublicKey: string;
};

type Listener = (snapshot: NetworkStateSnapshot) => void;

export class NetworkStateManager {
  private readonly listeners = new Set<Listener>();
  private lanFingerprint = networkInterfaceFingerprint();
  private lanTimer: ReturnType<typeof setInterval> | undefined;
  private tailscaleTimer: ReturnType<typeof setInterval> | undefined;
  private tailscaleRefresh: Promise<void> | undefined;
  private tailscale: TailscaleSnapshot = { checkedAt: 0 };
  private value: NetworkStateSnapshot;

  constructor(private readonly options: NetworkStateManagerOptions) {
    this.value = this.buildSnapshot();
  }

  snapshot() {
    return this.value;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    if (!this.lanTimer) {
      this.lanTimer = setInterval(() => this.pollLan(), lanPollIntervalMs);
    }
    if (!this.tailscaleTimer) {
      this.tailscaleTimer = setInterval(() => {
        void this.refreshTailscale();
      }, tailscalePollIntervalMs);
    }
    void this.refreshTailscale();
    return this;
  }

  stop() {
    if (this.lanTimer) clearInterval(this.lanTimer);
    if (this.tailscaleTimer) clearInterval(this.tailscaleTimer);
    this.lanTimer = undefined;
    this.tailscaleTimer = undefined;
    this.listeners.clear();
  }

  refreshTailscale() {
    if (!this.tailscaleRefresh) {
      const refresh = this.refreshTailscaleOnce();
      this.tailscaleRefresh = refresh;
      void refresh.finally(() => {
        if (this.tailscaleRefresh === refresh) this.tailscaleRefresh = undefined;
      });
    }
    return this.tailscaleRefresh;
  }

  private pollLan() {
    const nextFingerprint = networkInterfaceFingerprint();
    if (nextFingerprint !== this.lanFingerprint) {
      this.lanFingerprint = nextFingerprint;
    }
    // Rebuild even when LAN interfaces are unchanged. The macOS Tailcat helper
    // reports readiness through a status file after Relay startup, so a later
    // readiness record must be able to update the pairing QR without a network
    // interface change. recompute() suppresses no-op listener notifications.
    this.recompute();
  }

  private async refreshTailscaleOnce() {
    const status = await readTailscaleStatus();
    const serveHttpsUrl =
      status && isTailscaleStatusRunning(status)
        ? await readTailscaleServeHttpsUrl(status, this.options.port)
        : undefined;
    const next: TailscaleSnapshot = { checkedAt: Date.now(), serveHttpsUrl, status };
    if (sameTailscaleSnapshot(this.tailscale, next)) {
      this.tailscale = next;
      return;
    }
    this.tailscale = next;
    this.recompute();
  }

  private recompute() {
    const next = this.buildSnapshot();
    if (networkStateKey(next) === networkStateKey(this.value)) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  private buildSnapshot(): NetworkStateSnapshot {
    const connectUrlCandidates = getConnectUrlCandidates(
      { listenUrl: this.options.listenUrl, port: this.options.port },
      { tailscale: this.tailscale },
    );
    const connectUrl = connectUrlCandidates[0]?.url ?? this.options.listenUrl;
    const serverUrls = connectUrlCandidates.map((candidate) => candidate.url);
    const pairingPayload = createPairingQrPayload({
      serverPublicKey: this.options.serverPublicKey,
      serverUrls: serverUrls.length > 0 ? serverUrls : [connectUrl],
    });
    return {
      connectUrl,
      connectUrlCandidates,
      pairingPayload,
      tailscale: this.tailscale,
      updatedAt: Date.now(),
    };
  }
}

async function readTailscaleStatus(): Promise<TailscaleStatus | undefined> {
  const output = await runTailscale(["status", "--json"]);
  if (!output) return undefined;
  try {
    return JSON.parse(output) as TailscaleStatus;
  } catch {
    return undefined;
  }
}

async function readTailscaleServeHttpsUrl(status: TailscaleStatus, port: number) {
  const dnsName = status.Self?.DNSName?.replace(/\.$/, "");
  if (!dnsName) return undefined;
  const output = await runTailscale(["serve", "status", "--json"]);
  if (!output) return undefined;
  try {
    const serveStatus = JSON.parse(output) as {
      TCP?: Record<string, { HTTPS?: boolean }>;
      Web?: Record<string, unknown>;
    };
    const portKey = String(port);
    const hostPort = `${dnsName}:${portKey}`;
    return serveStatus.TCP?.[portKey]?.HTTPS && serveStatus.Web?.[hostPort]
      ? `https://${hostPort}`
      : undefined;
  } catch {
    return undefined;
  }
}

function runTailscale(args: string[]) {
  return new Promise<string | undefined>((resolve) => {
    execFile(
      "tailscale",
      args,
      {
        encoding: "utf8",
        timeout: tailscaleCommandTimeoutMs,
        windowsHide: true,
      },
      (error, stdout) => resolve(error ? undefined : stdout),
    );
  });
}

function sameTailscaleSnapshot(left: TailscaleSnapshot, right: TailscaleSnapshot) {
  return (
    JSON.stringify({ serveHttpsUrl: left.serveHttpsUrl, status: left.status }) ===
    JSON.stringify({ serveHttpsUrl: right.serveHttpsUrl, status: right.status })
  );
}

function networkStateKey(snapshot: NetworkStateSnapshot) {
  return JSON.stringify({
    connectUrl: snapshot.connectUrl,
    connectUrlCandidates: snapshot.connectUrlCandidates,
    pairingPayload: snapshot.pairingPayload,
    tailscale: {
      serveHttpsUrl: snapshot.tailscale.serveHttpsUrl,
      status: snapshot.tailscale.status,
    },
  });
}
