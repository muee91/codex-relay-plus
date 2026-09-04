import { StatusResponseSchema, apiPaths, type StatusResponse } from "codex-relay/api-schema";
import { Platform } from "react-native";
import { dfetch } from "react-native-direct-fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import { getClientSessionId, hasCodexRelaySession } from "./codex-relay-api";
import {
  codexRelayStorage as storage,
  getCodexRelayConnectionMode,
  getCodexRelayServerUrlCandidates,
  isCarrierGradePrivateIPv4Host,
  isLocalIPv6Host,
  isPrivateIPv4Host,
  setCodexRelayServerUrl,
} from "./codex-relay-server-url-storage";
import { requestWithNetworkTimeout } from "./network-timeout";
import { decryptResponsePayload } from "./secure-transport";

const clientTokenStorageKey = "codex-relay.client-token";
const connectionProbeTimeoutMs = 2500;

export type CodexRelayConnectionReconciliation = {
  serverUrl: string;
  status: StatusResponse;
};

let pendingReconciliation: Promise<CodexRelayConnectionReconciliation> | undefined;

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

  const candidates = getCodexRelayServerUrlCandidates();
  if (candidates.length === 0) {
    const mode = getCodexRelayConnectionMode();
    throw new Error(
      mode === "local"
        ? "No local network address is available for this computer."
        : mode === "remote"
          ? "No remote address is available for this computer."
          : "No relay server address is available.",
    );
  }

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const status = await probeCodexRelayServer(candidate.url);
      setCodexRelayServerUrl(candidate.url);
      return { serverUrl: candidate.url, status };
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
