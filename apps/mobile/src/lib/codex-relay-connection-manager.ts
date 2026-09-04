import { StatusResponseSchema, apiPaths, type StatusResponse } from "codex-relay/api-schema";
import { Platform } from "react-native";
import { dfetch } from "react-native-direct-fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import { getClientSessionId, hasCodexRelaySession } from "./codex-relay-api";
import {
  codexRelayStorage as storage,
  getAllCodexRelayServerUrlCandidates,
  getCodexRelayConnectionMode,
  getCodexRelayServerUrlCandidates,
  getTailcatBootstrapCandidate,
  isCarrierGradePrivateIPv4Host,
  isLocalIPv6Host,
  isLocalServerUrl,
  isPrivateIPv4Host,
  isTailcatBootstrapUrl,
  nativeTransportServerUrl,
  setCodexRelayServerUrl,
  setNativeRelayTransportConfigured,
} from "./codex-relay-server-url-storage";
import { requestWithNetworkTimeout } from "./network-timeout";
import { decryptResponsePayload } from "./secure-transport";
import {
  configureNativeRelayProxy,
  discoverNativeLocalRelay,
  isNativeTailcatAvailable,
  stopNativeTailcatProxy,
} from "./transport/native-tailcat";

const clientTokenStorageKey = "codex-relay.client-token";
const connectionProbeTimeoutMs = 2500;
const nativeDiscoveryIntervalMs = 15_000;

export type CodexRelayConnectionReconciliation = {
  serverUrl: string;
  status: StatusResponse;
};

let pendingReconciliation: Promise<CodexRelayConnectionReconciliation> | undefined;
let pendingNativeSync: Promise<string | undefined> | undefined;
let nativeRefreshTimer: ReturnType<typeof setInterval> | undefined;
let nativeSyncGeneration = 0;
let lastDiscoveredLocalUrl: string | undefined;

// Session token removal is the authoritative sign-out boundary. Observe it at
// the storage layer so native Tailcat teardown is not dependent on a Settings
// screen or a later React render. The root layout still performs the same
// teardown defensively when hydrated pairing state becomes false.
if (Platform.OS === "android") {
  void storage.addOnValueChangedListener((changedKey) => {
    if (changedKey === clientTokenStorageKey && !storage.getString(clientTokenStorageKey)) {
      void stopNativeTransport();
    }
  });
}

export function reconcileCodexRelayConnection() {
  if (!pendingReconciliation) {
    const reconciliation = reconcileCodexRelayConnectionOnce();
    pendingReconciliation = reconciliation;
    const clearPending = () => {
      if (pendingReconciliation === reconciliation) {
        pendingReconciliation = undefined;
      }
    };
    void reconciliation.then(clearPending, clearPending);
  }
  return pendingReconciliation;
}

export function teardownCodexRelayNativeTransport() {
  pendingReconciliation = undefined;
  return stopNativeTransport();
}

async function reconcileCodexRelayConnectionOnce(): Promise<CodexRelayConnectionReconciliation> {
  if (!hasCodexRelaySession()) {
    throw new Error("Pair this device before choosing a connection path.");
  }

  const mode = getCodexRelayConnectionMode();
  if (mode === "local") {
    await stopNativeTransport();
  }

  let nativeError: unknown;
  if (shouldUseNativeRelayTransport()) {
    try {
      const nativeUrl = await ensureNativeRelayTransportReady(true);
      if (nativeUrl) {
        return {
          serverUrl: nativeUrl,
          status: await probeCodexRelayServer(nativeUrl),
        };
      }
    } catch (error) {
      nativeError = error;
    }
  }

  const fallbackUrls = getCodexRelayServerUrlCandidates()
    .map((candidate) => candidate.url)
    .filter((url) => !isTailcatBootstrapUrl(url) && !isNativeLoopbackUrl(url));
  if (fallbackUrls.length === 0) {
    if (nativeError instanceof Error) {
      throw nativeError;
    }
    throw new Error(
      mode === "local"
        ? "No verified local network address is available for this computer."
        : mode === "remote"
          ? "No remote address is available for this computer."
          : "No relay server address is available.",
    );
  }

  try {
    return await probeCandidates(fallbackUrls);
  } catch (fallbackError) {
    throw nativeError instanceof Error ? nativeError : fallbackError;
  }
}

function shouldUseNativeRelayTransport() {
  return Boolean(
    Platform.OS === "android" &&
    getCodexRelayConnectionMode() !== "local" &&
    hasCodexRelaySession() &&
    isNativeTailcatAvailable() &&
    getTailcatBootstrapCandidate(),
  );
}

async function ensureNativeRelayTransportReady(forceDiscovery = false) {
  if (!shouldUseNativeRelayTransport()) {
    return undefined;
  }
  if (!pendingNativeSync) {
    const generation = nativeSyncGeneration;
    const sync = syncNativeTransport(forceDiscovery, generation);
    pendingNativeSync = sync;
    const clearPending = () => {
      if (pendingNativeSync === sync) {
        pendingNativeSync = undefined;
      }
    };
    void sync.then(clearPending, clearPending);
  }
  return pendingNativeSync;
}

async function syncNativeTransport(forceDiscovery: boolean, generation: number) {
  const bootstrap = getTailcatBootstrapCandidate();
  if (!bootstrap) {
    return undefined;
  }

  const mode = getCodexRelayConnectionMode();
  const candidateUrls = getAllCodexRelayServerUrlCandidates()
    .map((candidate) => candidate.url)
    .filter((url) => isLocalServerUrl(url));

  if (mode === "auto" && forceDiscovery) {
    const discovered = await discoverNativeLocalRelay(900).catch(() => null);
    if (discovered) {
      lastDiscoveredLocalUrl = discovered;
    }
  }
  if (mode === "auto" && lastDiscoveredLocalUrl) {
    candidateUrls.unshift(lastDiscoveredLocalUrl);
  }

  const verifiedLanTargets =
    mode === "remote" ? [] : await verifiedLanTcpTargets(dedupeStrings(candidateUrls));
  if (!isNativeSyncCurrent(generation, mode)) {
    return undefined;
  }

  const localUrl = await configureNativeRelayProxy({
    lanTargets: verifiedLanTargets,
    mode,
    remotePort: bootstrap.remotePort,
    serverAddr: bootstrap.address,
  });
  const normalized = new URL(localUrl).toString().replace(/\/$/, "");
  if (normalized !== nativeTransportServerUrl) {
    throw new Error(`Native Relay transport returned unexpected URL: ${normalized}`);
  }
  if (!isNativeSyncCurrent(generation, mode)) {
    return undefined;
  }

  setNativeRelayTransportConfigured(true);
  ensureBackgroundNativeDiscovery();
  return nativeTransportServerUrl;
}

function isNativeSyncCurrent(generation: number, mode: ReturnType<typeof getCodexRelayConnectionMode>) {
  return Boolean(
    generation === nativeSyncGeneration &&
    getCodexRelayConnectionMode() === mode &&
    hasCodexRelaySession() &&
    shouldUseNativeRelayTransport(),
  );
}

async function verifiedLanTcpTargets(urls: string[]) {
  const targets: string[] = [];
  for (const url of urls) {
    try {
      await probeCodexRelayServer(url);
      const target = httpUrlToTcpTarget(url);
      if (target) {
        targets.push(target);
      }
    } catch {
      // A LAN discovery result is advisory until the existing secure session
      // successfully authenticates the Relay behind that address.
    }
  }
  return dedupeStrings(targets);
}

function ensureBackgroundNativeDiscovery() {
  if (nativeRefreshTimer || Platform.OS !== "android") {
    return;
  }
  nativeRefreshTimer = setInterval(() => {
    if (!hasCodexRelaySession() || getCodexRelayConnectionMode() === "local") {
      void stopNativeTransport();
      return;
    }
    if (!shouldUseNativeRelayTransport() || getCodexRelayConnectionMode() !== "auto") {
      return;
    }
    void ensureNativeRelayTransportReady(true).catch(() => undefined);
  }, nativeDiscoveryIntervalMs);
}

async function stopNativeTransport() {
  nativeSyncGeneration += 1;
  if (nativeRefreshTimer) {
    clearInterval(nativeRefreshTimer);
    nativeRefreshTimer = undefined;
  }
  lastDiscoveredLocalUrl = undefined;
  pendingNativeSync = undefined;
  setNativeRelayTransportConfigured(false);
  await stopNativeTailcatProxy().catch(() => undefined);
}

async function probeCandidates(urls: string[]) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const status = await probeCodexRelayServer(url);
      setCodexRelayServerUrl(url);
      return { serverUrl: url, status };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach any relay server address allowed by the current connection mode.");
}

async function probeCodexRelayServer(serverUrl: string) {
  const clientToken = storage.getString(clientTokenStorageKey);
  if (!clientToken) {
    throw new Error("Pair this device before choosing a connection path.");
  }

  const url = `${serverUrl}${apiPaths.status}`;
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${clientToken}`,
    "x-codex-relay-client-session-id": getClientSessionId(),
  };
  const fetcher = shouldUseDirectFetch(url) ? dfetch : nitroFetch;
  const response = await requestWithNetworkTimeout(
    fetcher(url, { headers, method: "GET" }),
    connectionProbeTimeoutMs,
  );
  const payload = decryptResponsePayload(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new Error(`Codex Relay server returned ${response.status}.`);
  }
  return StatusResponseSchema.parse(payload);
}

function httpUrlToTcpTarget(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") {
      return undefined;
    }
    const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
    const port = parsed.port || "80";
    return host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;
  } catch {
    return undefined;
  }
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isNativeLoopbackUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" && parsed.port === "39127";
  } catch {
    return false;
  }
}

function shouldUseDirectFetch(url: string) {
  if (Platform.OS !== "ios") {
    return false;
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".local") ||
      host.endsWith(".ts.net") ||
      host.endsWith(".beta.tailscale.net") ||
      isPrivateIPv4Host(host) ||
      isCarrierGradePrivateIPv4Host(host) ||
      isLocalIPv6Host(host)
    );
  } catch {
    return false;
  }
}
