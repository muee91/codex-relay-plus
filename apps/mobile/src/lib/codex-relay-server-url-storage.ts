import { createMMKV } from "react-native-mmkv";

import {
  configureNativeRelayProxySync,
  isNativeTailcatAvailable,
} from "./transport/native-tailcat";

const defaultServerUrl = "http://localhost:8787";
export const nativeTransportServerUrl = "http://127.0.0.1:39127";
const connectionModeStorageKey = "codex-relay.connection-mode";
const serverUrlCandidatesStorageKey = "codex-relay.server-url-candidates";
const serverUrlStorageKey = "codex-relay.server-url";
const nativeTransportConfiguredStorageKey = "codex-relay.native-transport-configured-v1";
const tailcatBootstrapStorageKey = "codex-relay.tailcat-bootstrap-v1";

export const codexRelayStorage = createMMKV({ id: "codex-relay" });

export type CodexRelayConnectionMode = "auto" | "local" | "remote";
type CodexRelayServerUrlCandidateKind = "local" | "remote" | "loopback";

export type CodexRelayServerUrlCandidate = {
  label: string;
  url: string;
};

export type TailcatBootstrapCandidate = {
  address: string;
  remotePort: number;
};

export const fallbackCodexRelayServerUrl =
  process.env.EXPO_PUBLIC_CODEX_RELAY_SERVER_URL?.replace(/\/$/, "") ?? defaultServerUrl;

export function getCodexRelayConnectionMode(): CodexRelayConnectionMode {
  const stored = codexRelayStorage.getString(connectionModeStorageKey);
  return stored === "local" || stored === "remote" ? stored : "auto";
}

export function setCodexRelayConnectionMode(mode: CodexRelayConnectionMode) {
  codexRelayStorage.set(connectionModeStorageKey, mode);
  return mode;
}

export function getCodexRelayServerUrl() {
  const stored = codexRelayStorage.getString(serverUrlStorageKey) ?? fallbackCodexRelayServerUrl;
  if (getCodexRelayConnectionMode() === "local") {
    return firstStoredLocalServerUrl() ?? stored;
  }
  return isNativeRelayTransportConfigured() ? nativeTransportServerUrl : stored;
}

export function getCodexRelayServerUrlCandidates(): CodexRelayServerUrlCandidate[] {
  const tailcatAvailable = Boolean(getTailcatBootstrapCandidate());
  return routeServerUrlCandidates(
    getAllCodexRelayServerUrlCandidates(),
    getCodexRelayConnectionMode(),
  ).filter(
    (candidate) =>
      !isTailcatBootstrapUrl(candidate.url) &&
      !(tailcatAvailable && isLegacyTailscaleServerUrl(candidate.url)),
  );
}

export function getAllCodexRelayServerUrlCandidates(): CodexRelayServerUrlCandidate[] {
  return serverUrlCandidatesFromUrls([
    getCodexRelayServerUrl(),
    ...readStoredServerUrlCandidates(),
  ]);
}

export function setCodexRelayServerUrl(url: string) {
  const normalizedUrl = normalizeServerUrl(url);
  codexRelayStorage.set(serverUrlStorageKey, normalizedUrl);
  return normalizedUrl;
}

export function clearCodexRelayServerUrlState() {
  codexRelayStorage.remove(serverUrlStorageKey);
  codexRelayStorage.remove(serverUrlCandidatesStorageKey);
  codexRelayStorage.remove(connectionModeStorageKey);
  codexRelayStorage.remove(nativeTransportConfiguredStorageKey);
  codexRelayStorage.remove(tailcatBootstrapStorageKey);
}

export function saveCodexRelayServerUrlCandidates(urls: string[]) {
  codexRelayStorage.set(serverUrlCandidatesStorageKey, JSON.stringify(dedupeServerUrls(urls)));
}

export function isNativeRelayTransportConfigured() {
  return codexRelayStorage.getBoolean(nativeTransportConfiguredStorageKey) === true;
}

export function setNativeRelayTransportConfigured(configured: boolean) {
  if (configured) {
    codexRelayStorage.set(nativeTransportConfiguredStorageKey, true);
  } else {
    codexRelayStorage.remove(nativeTransportConfiguredStorageKey);
  }
}

export function getTailcatBootstrapCandidate(): TailcatBootstrapCandidate | undefined {
  const stored = readStoredTailcatBootstrap();
  if (stored) {
    return stored;
  }

  for (const value of readStoredServerUrlCandidates()) {
    const candidate = tailcatBootstrapCandidateFromUrl(value);
    if (candidate) {
      persistTailcatBootstrap(candidate);
      return candidate;
    }
  }
  return undefined;
}

export function normalizeServerUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new Error("Server URL is empty.");
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must start with http:// or https://.");
  }

  const tailcat = tailcatBootstrapCandidateFromUrl(parsed.toString());
  if (tailcat) {
    persistTailcatBootstrap(tailcat);
    if (!isNativeTailcatAvailable()) {
      return parsed.toString().replace(/\/$/, "");
    }

    const localUrl = configureNativeRelayProxySync({
      lanTargets: [],
      mode: "remote",
      remotePort: tailcat.remotePort,
      serverAddr: tailcat.address,
    });
    const normalizedLocalUrl = new URL(localUrl).toString().replace(/\/$/, "");
    if (normalizedLocalUrl !== nativeTransportServerUrl) {
      throw new Error(`Tailcat transport returned unexpected URL: ${normalizedLocalUrl}`);
    }
    return normalizedLocalUrl;
  }

  return parsed.toString().replace(/\/$/, "");
}

export function dedupeServerUrls(urls: string[]) {
  const deduped = new Set<string>();
  for (const url of urls) {
    try {
      deduped.add(normalizeServerUrl(url));
    } catch {
      continue;
    }
  }
  return [...deduped];
}

export function routeServerUrlCandidates(
  candidates: CodexRelayServerUrlCandidate[],
  mode: CodexRelayConnectionMode,
) {
  if (mode === "local") {
    return candidates.filter((candidate) => serverUrlCandidateKind(candidate.url) === "local");
  }
  if (mode === "remote") {
    return candidates.filter((candidate) => serverUrlCandidateKind(candidate.url) === "remote");
  }

  const rank: Record<CodexRelayServerUrlCandidateKind, number> = {
    local: 0,
    remote: 1,
    loopback: 2,
  };
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      kind: serverUrlCandidateKind(candidate.url),
    }))
    .sort((left, right) => rank[left.kind] - rank[right.kind] || left.index - right.index)
    .map(({ candidate }) => candidate);
}

export function isPrivateIPv4Host(host: string) {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

export function isCarrierGradePrivateIPv4Host(host: string) {
  const octets = host.split(".").map(Number);
  return octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export function isLocalIPv6Host(host: string) {
  const normalized = host.replace(/^\[/, "").replace(/\]$/, "");
  return (
    normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")
  );
}

export function isLocalServerUrl(url: string) {
  return serverUrlCandidateKind(url) === "local";
}

export function isTailcatBootstrapUrl(url: string) {
  return Boolean(tailcatBootstrapCandidateFromUrl(url));
}

function firstStoredLocalServerUrl() {
  return readStoredServerUrlCandidates().find((url) => serverUrlCandidateKind(url) === "local");
}

function readStoredServerUrlCandidates() {
  const stored = codexRelayStorage.getString(serverUrlCandidatesStorageKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((url): url is string => typeof url === "string")
      : [];
  } catch {
    return [];
  }
}

function readStoredTailcatBootstrap(): TailcatBootstrapCandidate | undefined {
  const stored = codexRelayStorage.getString(tailcatBootstrapStorageKey);
  if (!stored) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<TailcatBootstrapCandidate>;
    return validTailcatBootstrap(parsed.address, parsed.remotePort);
  } catch {
    return undefined;
  }
}

function persistTailcatBootstrap(candidate: TailcatBootstrapCandidate) {
  codexRelayStorage.set(tailcatBootstrapStorageKey, JSON.stringify(candidate));
}

function tailcatBootstrapCandidateFromUrl(value: string): TailcatBootstrapCandidate | undefined {
  try {
    const url = new URL(value);
    if (url.hostname !== "tailcat.invalid" || url.searchParams.get("v") !== "1") {
      return undefined;
    }
    return validTailcatBootstrap(
      url.searchParams.get("addr")?.trim(),
      Number(url.searchParams.get("port")),
    );
  } catch {
    return undefined;
  }
}

function validTailcatBootstrap(address: unknown, remotePort: unknown) {
  if (
    typeof address === "string" &&
    address.startsWith("tc") &&
    typeof remotePort === "number" &&
    Number.isSafeInteger(remotePort) &&
    remotePort >= 1 &&
    remotePort <= 65535
  ) {
    return { address, remotePort };
  }
  return undefined;
}

function serverUrlCandidatesFromUrls(urls: string[]): CodexRelayServerUrlCandidate[] {
  return dedupeServerUrls(urls).map((url) => ({
    label: serverUrlCandidateLabel(url),
    url,
  }));
}

function serverUrlCandidateKind(url: string): CodexRelayServerUrlCandidateKind {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return "loopback";
    }
    if (
      host === "tailcat.invalid" ||
      host.endsWith(".ts.net") ||
      host.endsWith(".beta.tailscale.net") ||
      isCarrierGradePrivateIPv4Host(host)
    ) {
      return "remote";
    }
    if (host.endsWith(".local") || isPrivateIPv4Host(host) || isLocalIPv6Host(host)) {
      return "local";
    }
    return "remote";
  } catch {
    return "remote";
  }
}

function serverUrlCandidateLabel(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return host === "127.0.0.1" && parsed.port === "39127" ? "Tailcat" : "Localhost";
    }
    if (host === "tailcat.invalid") {
      return "Tailcat remote";
    }
    if (host.endsWith(".local")) {
      return "Local network";
    }
    if (host.endsWith(".ts.net") || host.endsWith(".beta.tailscale.net")) {
      return "Legacy Tailscale DNS";
    }
    if (isCarrierGradePrivateIPv4Host(host)) {
      return "Legacy Tailscale IP";
    }
    if (isPrivateIPv4Host(host) || isLocalIPv6Host(host)) {
      return "LAN IP";
    }
    return "Remote server";
  } catch {
    return "Remote server";
  }
}

function isLegacyTailscaleServerUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".ts.net") ||
      host.endsWith(".beta.tailscale.net") ||
      isCarrierGradePrivateIPv4Host(host)
    );
  } catch {
    return false;
  }
}
