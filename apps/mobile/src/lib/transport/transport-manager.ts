import { Platform } from "react-native";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import {
  codexRelayStorage,
  getAllCodexRelayServerUrlCandidates,
  getCodexRelayConnectionMode,
  routeServerUrlCandidates,
  saveCodexRelayServerUrlCandidates,
  setCodexRelayServerUrl,
} from "../codex-relay-server-url-storage";
import { requestWithNetworkTimeout } from "../network-timeout";
import {
  discoverNativeLocalRelay,
  getNativeTailcatStatus,
  isNativeTailcatAvailable,
  refreshNativeTailcatPath,
  startNativeTailcatProxy,
  type TailcatPathStatus,
} from "./native-tailcat";

const tailcatBootstrapStorageKey = "codex-relay.tailcat-bootstrap-v1";
const remoteFallbackFailureThreshold = 2;
const remoteToLanCooldownMs = 10_000;
const lanPromotionProbeIntervalMs = 5_000;
const lanPromotionSuccessThreshold = 2;
const lanProbeTimeoutMs = 1_500;

type TailcatBootstrap = {
  address: string;
  remotePort: number;
  transportVersion: 1;
};

let pendingActivation: Promise<string> | undefined;
let consecutiveLocalFailures = 0;
let activeTailcatProxyUrl: string | undefined;
let remoteActivatedAt = 0;
let nextLanProbeAt = 0;
let consecutiveLanPromotionSuccesses = 0;
let pendingLanProbe: Promise<void> | undefined;

export function rememberTailcatBootstrap(input: {
  address: string;
  remotePort: number;
  transportVersion?: number;
}) {
  const address = input.address.trim();
  if (!address.startsWith("tc") || !Number.isInteger(input.remotePort) || input.remotePort < 1 || input.remotePort > 65535) {
    return false;
  }
  const bootstrap: TailcatBootstrap = {
    address,
    remotePort: input.remotePort,
    transportVersion: 1,
  };
  codexRelayStorage.set(tailcatBootstrapStorageKey, JSON.stringify(bootstrap));
  return true;
}

export function clearTailcatBootstrap() {
  codexRelayStorage.remove(tailcatBootstrapStorageKey);
  activeTailcatProxyUrl = undefined;
  consecutiveLocalFailures = 0;
  consecutiveLanPromotionSuccesses = 0;
}

export function getTailcatBootstrap(): TailcatBootstrap | undefined {
  const stored = codexRelayStorage.getString(tailcatBootstrapStorageKey);
  if (!stored) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<TailcatBootstrap>;
    if (
      parsed.transportVersion === 1 &&
      typeof parsed.address === "string" &&
      parsed.address.startsWith("tc") &&
      Number.isInteger(parsed.remotePort) &&
      Number(parsed.remotePort) >= 1 &&
      Number(parsed.remotePort) <= 65535
    ) {
      return parsed as TailcatBootstrap;
    }
  } catch {}
  return undefined;
}

export async function activateTailcatTransport() {
  if (Platform.OS !== "android" || !isNativeTailcatAvailable()) {
    throw new Error("This build does not include the Android Tailcat transport.");
  }
  const bootstrap = getTailcatBootstrap();
  if (!bootstrap) {
    throw new Error("No Tailcat bootstrap address is stored for this computer.");
  }
  if (!pendingActivation) {
    const activation = startNativeTailcatProxy(bootstrap.address, bootstrap.remotePort).then((url) => {
      activeTailcatProxyUrl = normalizeLoopbackUrl(url);
      remoteActivatedAt = Date.now();
      consecutiveLocalFailures = 0;
      consecutiveLanPromotionSuccesses = 0;
      setCodexRelayServerUrl(activeTailcatProxyUrl);
      void refreshNativeTailcatPath().catch(() => undefined);
      return activeTailcatProxyUrl;
    });
    pendingActivation = activation;
    void activation.finally(() => {
      if (pendingActivation === activation) {
        pendingActivation = undefined;
      }
    });
  }
  return pendingActivation;
}

// Called only after a real network error. It implements hysteresis for normal
// LAN failures, but an already-selected loopback Tailcat URL is restored
// immediately after an app-process restart because its previous native listener
// is necessarily gone.
export async function recoverCodexRelayRequestUrl(failedUrl: string) {
  const mode = getCodexRelayConnectionMode();
  if (mode === "local" || Platform.OS !== "android" || !getTailcatBootstrap()) {
    return undefined;
  }

  const failedWasLoopback = isLoopbackUrl(failedUrl);
  if (!failedWasLoopback) {
    consecutiveLocalFailures += 1;
  }
  if (
    mode !== "remote" &&
    !failedWasLoopback &&
    consecutiveLocalFailures < remoteFallbackFailureThreshold
  ) {
    return undefined;
  }

  const proxyUrl = await activateTailcatTransport();
  return replaceOrigin(failedUrl, proxyUrl);
}

export function noteCodexRelayTransportSuccess(requestUrl: string) {
  if (!isLoopbackUrl(requestUrl)) {
    consecutiveLocalFailures = 0;
    consecutiveLanPromotionSuccesses = 0;
    return;
  }
  if (getCodexRelayConnectionMode() !== "auto" || !getTailcatBootstrap()) {
    return;
  }
  const now = Date.now();
  if (now < remoteActivatedAt + remoteToLanCooldownMs || now < nextLanProbeAt || pendingLanProbe) {
    return;
  }
  nextLanProbeAt = now + lanPromotionProbeIntervalMs;
  const probe = probeForLanPromotion();
  pendingLanProbe = probe;
  void probe.finally(() => {
    if (pendingLanProbe === probe) {
      pendingLanProbe = undefined;
    }
  });
}

export async function getTailcatTransportStatus(): Promise<TailcatPathStatus> {
  return getNativeTailcatStatus();
}

async function probeForLanPromotion() {
  const discovered = await discoverNativeLocalRelay(900).catch(() => null);
  const known = routeServerUrlCandidates(getAllCodexRelayServerUrlCandidates(), "local").map(
    (candidate) => candidate.url,
  );
  const urls = dedupeUrls([...(discovered ? [discovered] : []), ...known]);
  for (const url of urls) {
    if (await probeRelayVersion(url)) {
      consecutiveLanPromotionSuccesses += 1;
      if (consecutiveLanPromotionSuccesses >= lanPromotionSuccessThreshold) {
        setCodexRelayServerUrl(url);
        saveCodexRelayServerUrlCandidates([
          url,
          ...getAllCodexRelayServerUrlCandidates().map((candidate) => candidate.url),
        ]);
        consecutiveLocalFailures = 0;
        consecutiveLanPromotionSuccesses = 0;
      }
      return;
    }
  }
  consecutiveLanPromotionSuccesses = 0;
}

async function probeRelayVersion(serverUrl: string) {
  try {
    const response = await requestWithNetworkTimeout(
      nitroFetch(`${serverUrl}/v1/version`, {
        headers: { accept: "application/json" },
        method: "GET",
      }),
      lanProbeTimeoutMs,
    );
    return response.ok;
  } catch {
    return false;
  }
}

function replaceOrigin(url: string, origin: string) {
  const source = new URL(url);
  const target = new URL(origin);
  source.protocol = target.protocol;
  source.hostname = target.hostname;
  source.port = target.port;
  return source.toString();
}

function normalizeLoopbackUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" || !isLoopbackHost(parsed.hostname)) {
    throw new Error(`Native Tailcat bridge returned a non-loopback URL: ${url}`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function isLoopbackUrl(url: string) {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(host: string) {
  const normalized = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function dedupeUrls(urls: string[]) {
  const seen = new Set<string>();
  for (const url of urls) {
    try {
      seen.add(new URL(url).toString().replace(/\/$/, ""));
    } catch {}
  }
  return [...seen];
}
