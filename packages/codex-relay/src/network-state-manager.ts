import {
  createPairingQrPayload,
  getConnectUrlCandidates,
  networkInterfaceFingerprint,
  type ConnectUrlCandidate,
  type TailscaleSnapshot,
} from "./pairing-url-candidates.js";

const lanPollIntervalMs = 5_000;

export type NetworkStateSnapshot = {
  connectUrl: string;
  connectUrlCandidates: ConnectUrlCandidate[];
  pairingPayload: string;
  /** @deprecated Kept in persisted state for compatibility. Relay transport no longer probes Tailscale. */
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
    return this;
  }

  stop() {
    if (this.lanTimer) clearInterval(this.lanTimer);
    this.lanTimer = undefined;
    this.listeners.clear();
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

  private recompute() {
    const next = this.buildSnapshot();
    if (networkStateKey(next) === networkStateKey(this.value)) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  private buildSnapshot(): NetworkStateSnapshot {
    const connectUrlCandidates = getConnectUrlCandidates({
      listenUrl: this.options.listenUrl,
      port: this.options.port,
    });
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
      // Keep the old field shape so persisted server-state consumers remain
      // forward compatible while Tailcat replaces Tailscale for connectivity.
      tailscale: { checkedAt: 0 },
      updatedAt: Date.now(),
    };
  }
}

function networkStateKey(snapshot: NetworkStateSnapshot) {
  return JSON.stringify({
    connectUrl: snapshot.connectUrl,
    connectUrlCandidates: snapshot.connectUrlCandidates,
    pairingPayload: snapshot.pairingPayload,
  });
}
