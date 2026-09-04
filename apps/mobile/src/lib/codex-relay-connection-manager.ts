import { StatusResponseSchema, apiPaths, type StatusResponse } from "codex-relay/api-schema";
import { Platform } from "react-native";
import { dfetch } from "react-native-direct-fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import { getClientSessionId, hasCodexRelaySession } from "./codex-relay-api";
import {
  codexRelayStorage as storage,
  getCodexRelayConnectionMode,
  getCodexRelayServerUrl,
  getCodexRelayServerUrlCandidates,
  isCarrierGradePrivateIPv4Host,
  isLocalIPv6Host,
  isPrivateIPv4Host,
  setCodexRelayServerUrl,
} from "./codex-relay-server-url-storage";
import { requestWithNetworkTimeout } from "./network-timeout";
import { decryptResponsePayload } from "./secure-transport";
import {
  activateTailcatTransport,
  rememberTailcatBootstrap,
} from "./transport/transport-manager";

const clientTokenStorageKey = "codex-relay.client-token";
const connectionProbeTimeoutMs = 2500;
const autoRemoteFailureThreshold = 2;
const remoteToLanCooldownMs = 10_000;
const lanRecoverySuccessThreshold = 2;

export type CodexRelayConnectionReconciliation = {
  serverUrl: string;
  status: StatusResponse;
};

let pendingReconciliation: Promise<CodexRelayConnectionReconciliation> | undefined;
let consecutiveAutoLocalFailures = 0;
let consecutiveLanRecoverySuccesses = 0;
let remoteActivatedAt = 0;

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

async function reconcileCodexRelayConnectionOnce(): Promise<CodexRelayConnectionReconciliation> {
  if (!hasCodexRelaySession()) {
    throw new Error("Pair this device before choosing a connection path.");
  }

  const mode = getCodexRelayConnectionMode();
  const candidates = getCodexRelayServerUrlCandidates();
  if (candidates.length === 0) {
    throw new Error(
      mode === "local"
        ? "No local network address is available for this computer."
        : mode === "remote"
          ? "No remote address is available for this computer."
          : "No relay server address is available.",
    );
  }

  if (mode !== "auto") {
    return probeCandidates(candidates.map((candidate) => candidate.url));
  }

  const localUrls = candidates
    .map((candidate) => candidate.url)
    .filter((url) => isLocalNetworkUrl(url));
  const remoteUrls = candidates
    .map((candidate) => candidate.url)
    .filter((url) => !isLocalNetworkUrl(url) && !isLoopbackUrl(url));
  const currentUrl = getCodexRelayServerUrl();
  const currentlyRemote = isLoopbackUrl(currentUrl) || isRemoteNetworkUrl(currentUrl);
  let lastLocalError: unknown;

  const mayProbeLan = !currentlyRemote || Date.now() >= remoteActivatedAt + remoteToLanCooldownMs;
  if (mayProbeLan && localUrls.length > 0) {
    try {
      const local = await probeCandidates(localUrls, false);
      consecutiveAutoLocalFailures = 0;
      if (!currentlyRemote) {
        consecutiveLanRecoverySuccesses = 0;
        setCodexRelayServerUrl(local.serverUrl);
        return local;
      }
      consecutiveLanRecoverySuccesses += 1;
      if (consecutiveLanRecoverySuccesses >= lanRecoverySuccessThreshold) {
        consecutiveLanRecoverySuccesses = 0;
        setCodexRelayServerUrl(local.serverUrl);
        return local;
      }
    } catch (error) {
      lastLocalError = error;
      consecutiveLanRecoverySuccesses = 0;
      if (!currentlyRemote) {
        consecutiveAutoLocalFailures += 1;
      }
    }
  }

  if (!currentlyRemote && consecutiveAutoLocalFailures < autoRemoteFailureThreshold) {
    throw lastLocalError instanceof Error
      ? lastLocalError
      : new Error("Local Relay probe failed; waiting for a confirming failure before remote fallback.");
  }

  if (remoteUrls.length > 0) {
    const remote = await probeCandidates(remoteUrls);
    if (!currentlyRemote) {
      remoteActivatedAt = Date.now();
    }
    return remote;
  }

  // The current Tailcat loopback URL is intentionally not persisted as a
  // candidate. If it is still selected, restarting its fixed bootstrap is the
  // final remote path after LAN failures.
  if (isLoopbackUrl(currentUrl)) {
    const status = await probeCodexRelayServer(currentUrl);
    return { serverUrl: currentUrl, status };
  }

  throw lastLocalError instanceof Error
    ? lastLocalError
    : new Error("Could not reach any relay server address allowed by automatic routing.");
}

async function probeCandidates(urls: string[], persistSelection = true) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const targetUrl = isTailcatBootstrapCandidate(url)
        ? await activateTailcatCandidate(url)
        : url;
      const status = await probeCodexRelayServer(targetUrl);
      if (persistSelection) {
        setCodexRelayServerUrl(targetUrl);
      }
      return { serverUrl: targetUrl, status };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach any relay server address allowed by the current connection mode.");
}

async function activateTailcatCandidate(url: string) {
  const parsed = new URL(url);
  const address = parsed.searchParams.get("addr")?.trim();
  const remotePort = Number(parsed.searchParams.get("port"));
  if (!address || !rememberTailcatBootstrap({ address, remotePort, transportVersion: 1 })) {
    throw new Error("Stored Tailcat bootstrap candidate is invalid.");
  }
  const proxyUrl = await activateTailcatTransport();
  remoteActivatedAt = Date.now();
  return proxyUrl;
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

function isTailcatBootstrapCandidate(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "tailcat.invalid" && parsed.searchParams.get("v") === "1";
  } catch {
    return false;
  }
}

function isLocalNetworkUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".local") ||
      (isPrivateIPv4Host(host) && !isCarrierGradePrivateIPv4Host(host)) ||
      isLocalIPv6Host(host)
    );
  } catch {
    return false;
  }
}

function isRemoteNetworkUrl(url: string) {
  return !isLocalNetworkUrl(url) && !isLoopbackUrl(url) && !isTailcatBootstrapCandidate(url);
}

function isLoopbackUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
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
