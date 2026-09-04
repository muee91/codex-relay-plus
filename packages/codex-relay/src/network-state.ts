import type { ConnectUrlCandidate } from "./pairing-url-candidates.js";
import {
  createPairingQrPayload,
  getConnectUrlCandidatesAsync,
} from "./pairing-url-candidates.js";
import { TailcatServerTransport, type TailcatServerState } from "./tailcat-transport.js";

export type RelayNetworkState = {
  connectUrl: string;
  connectUrlCandidates: ConnectUrlCandidate[];
  generation: number;
  pairingPayload: string;
  preferredTransport: "lan" | "tailcat" | "remote" | "local";
  tailcat: TailcatServerState & { port: number };
  updatedAt: number;
};

export type RelayNetworkStateManagerOptions = {
  listenUrl: string;
  onChange?: (state: RelayNetworkState) => void;
  port: number;
  refreshIntervalMs?: number;
  serverPublicKey: string;
  tailcatBinaryPath?: string;
  tailcatKeyPath?: string;
};

export class RelayNetworkStateManager {
  private closed = false;
  private generation = 0;
  private interval: NodeJS.Timeout | undefined;
  private pendingRefresh: Promise<RelayNetworkState> | undefined;
  private state: RelayNetworkState;
  private readonly tailcat: TailcatServerTransport;

  constructor(private readonly options: RelayNetworkStateManagerOptions) {
    this.tailcat = new TailcatServerTransport({
      binaryPath: options.tailcatBinaryPath,
      keyPath: options.tailcatKeyPath,
      port: options.port,
      onChange: () => void this.refresh(),
    });
    this.state = this.buildState([], this.tailcat.getState());
  }

  async start() {
    this.closed = false;
    void this.tailcat.start();
    const state = await this.refresh();
    const intervalMs = Math.max(2000, this.options.refreshIntervalMs ?? 5000);
    this.interval = setInterval(() => void this.refresh(), intervalMs);
    this.interval.unref?.();
    return state;
  }

  getState() {
    return this.state;
  }

  refresh() {
    if (this.closed) {
      return Promise.resolve(this.state);
    }
    if (!this.pendingRefresh) {
      const refresh = this.refreshOnce();
      this.pendingRefresh = refresh;
      void refresh.finally(() => {
        if (this.pendingRefresh === refresh) {
          this.pendingRefresh = undefined;
        }
      });
    }
    return this.pendingRefresh;
  }

  stop() {
    this.closed = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.tailcat.stop();
  }

  private async refreshOnce() {
    let candidates = this.state.connectUrlCandidates;
    try {
      candidates = await getConnectUrlCandidatesAsync({
        listenUrl: this.options.listenUrl,
        port: this.options.port,
      });
    } catch {
      // Keep the last known-good addresses. A transient interface/Tailscale probe
      // must not erase a working QR while the network is transitioning.
    }
    const next = this.buildState(candidates, this.tailcat.getState());
    if (networkStateFingerprint(next) !== networkStateFingerprint(this.state)) {
      this.generation += 1;
      next.generation = this.generation;
      this.state = next;
      this.options.onChange?.(next);
    } else {
      this.state = { ...this.state, updatedAt: Date.now() };
    }
    return this.state;
  }

  private buildState(candidates: ConnectUrlCandidate[], tailcat: TailcatServerState) {
    const connectUrl = candidates[0]?.url ?? this.options.listenUrl;
    const serverUrls = candidates.length > 0 ? candidates.map((candidate) => candidate.url) : [connectUrl];
    const pairingPayload = createPairingQrPayload({
      serverPublicKey: this.options.serverPublicKey,
      serverUrls,
      tailcat: tailcat.address
        ? {
            address: tailcat.address,
            port: this.options.port,
          }
        : undefined,
    });
    return {
      connectUrl,
      connectUrlCandidates: candidates,
      generation: this.generation,
      pairingPayload,
      preferredTransport: preferredTransport(candidates, tailcat.available),
      tailcat: { ...tailcat, port: this.options.port },
      updatedAt: Date.now(),
    } satisfies RelayNetworkState;
  }
}

function preferredTransport(candidates: ConnectUrlCandidate[], tailcatAvailable: boolean) {
  if (candidates.some((candidate) => candidate.kind === "lan")) {
    return "lan" as const;
  }
  if (tailcatAvailable) {
    return "tailcat" as const;
  }
  if (candidates.some((candidate) => candidate.kind === "tailscale" || candidate.kind === "server")) {
    return "remote" as const;
  }
  return "local" as const;
}

function networkStateFingerprint(state: RelayNetworkState) {
  return JSON.stringify({
    connectUrl: state.connectUrl,
    candidates: state.connectUrlCandidates,
    pairingPayload: state.pairingPayload,
    tailcatAddress: state.tailcat.address,
    tailcatAvailable: state.tailcat.available,
  });
}
