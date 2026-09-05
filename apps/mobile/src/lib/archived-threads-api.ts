import { ListThreadsResponseSchema, type ListThreadsResponse } from "codex-relay/api-schema";
import { Platform } from "react-native";
import { dfetch } from "react-native-direct-fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import { getClientSessionId } from "./codex-relay-api";
import {
  codexRelayStorage as storage,
  getCodexRelayServerUrl,
  isCarrierGradePrivateIPv4Host,
  isLocalIPv6Host,
  isPrivateIPv4Host,
} from "./codex-relay-server-url-storage";
import { requestWithNetworkTimeout } from "./network-timeout";
import { decryptResponsePayload } from "./secure-transport";

const clientTokenStorageKey = "codex-relay.client-token";
const archivedThreadsPath = "/v1/threads/archived";
const unarchiveThreadPath = (threadId: string) =>
  `/v1/threads/${encodeURIComponent(threadId)}/unarchive`;

type NetworkRequestInit = RequestInit & {
  timeoutMs?: number;
};

export async function listArchivedThreads(): Promise<ListThreadsResponse> {
  return requestArchivedThreads(archivedThreadsPath);
}

export async function restoreArchivedThread(threadId: string): Promise<ListThreadsResponse> {
  return requestArchivedThreads(unarchiveThreadPath(threadId), { method: "POST" });
}

async function requestArchivedThreads(path: string, init: RequestInit = {}) {
  const response = await fetchWithNetworkContext(`${getCodexRelayServerUrl()}${path}`, {
    ...init,
    headers: requestHeaders(init.headers),
  });
  const payload = decryptResponsePayload(await response.json().catch(() => undefined));
  if (!response.ok) {
    throw new Error(responseErrorMessage(payload, `Codex Relay server returned ${response.status}`));
  }
  return ListThreadsResponseSchema.parse(payload);
}

function requestHeaders(initHeaders: HeadersInit | undefined) {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  for (const [key, value] of new Headers(initHeaders)) {
    headers.set(key, value);
  }

  const clientToken = storage.getString(clientTokenStorageKey);
  if (clientToken) {
    headers.set("authorization", `Bearer ${clientToken}`);
  }
  headers.set("x-codex-relay-client-session-id", getClientSessionId());
  return headers;
}

async function fetchWithNetworkContext(url: string, init?: NetworkRequestInit) {
  if (isLocalhostUrl(url)) {
    return requestWithNetworkTimeout(fetch(url, init), init?.timeoutMs);
  }

  if (shouldUseDirectFetch(url, init)) {
    return requestWithNetworkTimeout(dfetch(url, init), init?.timeoutMs);
  }
  return requestWithNetworkTimeout(nitroFetch(url, init), init?.timeoutMs);
}

function shouldUseDirectFetch(url: string, init?: NetworkRequestInit) {
  if (Platform.OS !== "ios" || !isDirectFetchSupportedBody(init?.body)) {
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

function isDirectFetchSupportedBody(body: NetworkRequestInit["body"] | undefined) {
  if (body == null || typeof body === "string") {
    return true;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return true;
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return true;
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return true;
  }
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true;
  }
  return false;
}

function isLocalhostUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function responseErrorMessage(payload: unknown, fallback: string) {
  return payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error
    ? String(payload.error.message)
    : fallback;
}
