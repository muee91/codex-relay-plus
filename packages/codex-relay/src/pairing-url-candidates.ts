import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

export type ConnectUrlCandidateKind = "lan" | "tailscale" | "server";
export type ConnectUrlMode = "auto" | "local" | "remote";

export type ConnectUrlCandidate = {
  kind: ConnectUrlCandidateKind;
  label: string;
  url: string;
};

// Kept for compatibility with older callers and persisted diagnostics. Relay
// connectivity no longer polls or advertises Tailscale automatically.
export type TailscaleStatus = {
  BackendState?: string;
  Self?: {
    DNSName?: string;
    Online?: boolean;
    TailscaleIPs?: string[];
  };
};

export type TailscaleSnapshot = {
  checkedAt: number;
  serveHttpsUrl?: string;
  status?: TailscaleStatus;
};

export type TailcatSnapshot = {
  address?: string;
  checkedAt: number;
  configured: boolean;
  port?: number;
  ready: boolean;
};

export function getConnectUrlGuidance(url: string) {
  const host = parseUrlHost(url);
  if (!host) return undefined;
  if (isLocalhost(host) || isUnspecifiedHost(host)) {
    return (
      "This address is only reachable from this computer. " +
      "Use a same-Wi-Fi address or the built-in Tailcat remote path for mobile pairing."
    );
  }
  if (isTailscaleHost(host)) {
    return "This is a legacy Tailscale address. New mobile pairings use Tailcat for remote connectivity.";
  }
  if (isPrivateIPv4Host(host) || isLocalIPv6Host(host) || host.endsWith(".local")) {
    return "Using a local Wi-Fi/LAN address. Tailcat is used automatically when the phone leaves the LAN.";
  }
  return "Using a configured or public address. Make sure the phone can reach it before pairing.";
}

export function createPairingQrPayload(details: { serverPublicKey: string; serverUrls: string[] }) {
  const primaryServerUrl = details.serverUrls[0];
  if (!primaryServerUrl) throw new Error("Pairing QR requires at least one server URL.");

  const tailcat = tailcatBootstrapCandidate();
  const candidateUrls = tailcat ? [...details.serverUrls, tailcat.candidateUrl] : details.serverUrls;

  const url = new URL("codex-relay://pair");
  url.searchParams.set("serverUrl", primaryServerUrl);
  url.searchParams.set("serverPublicKey", details.serverPublicKey);
  const compacted = compactCandidateHosts(primaryServerUrl, candidateUrls);
  if (compacted.hosts.length > 0) url.searchParams.set("h", compacted.hosts.join(","));
  if (compacted.fullUrls.length > 0) {
    url.searchParams.set("serverUrls", JSON.stringify(compacted.fullUrls));
  }
  if (tailcat) {
    url.searchParams.set("tailcatAddr", tailcat.address);
    url.searchParams.set("tailcatPort", String(tailcat.port));
    url.searchParams.set("transportVersion", "1");
  }
  return url.toString();
}

export function getConnectUrlCandidates(
  details: { listenUrl: string; port: number },
  options: { mode?: ConnectUrlMode; tailscale?: TailscaleSnapshot } = {},
) {
  const serverCandidate = configuredServerCandidate(details.listenUrl);
  const candidates = dedupeCandidates([
    ...localNetworkConnectUrlCandidates(details.port),
    ...(serverCandidate ? [serverCandidate] : []),
  ]);
  return filterCandidatesForMode(
    prioritizeConnectUrlCandidates(candidates),
    options.mode ?? "auto",
  );
}

export function getTailcatSnapshot(): TailcatSnapshot {
  const candidate = tailcatBootstrapCandidate();
  return {
    address: candidate?.address,
    checkedAt: Date.now(),
    configured: Boolean(
      process.env.CODEX_RELAY_TAILCAT_ADDR?.trim() ||
        process.env.CODEX_RELAY_TAILCAT_STATUS_FILE?.trim(),
    ),
    port: candidate?.port,
    ready: Boolean(candidate),
  };
}

export function prioritizeConnectUrlCandidates(candidates: ConnectUrlCandidate[]) {
  return candidates
    .map((candidate, index) => ({ candidate, index, rank: connectUrlCandidateRank(candidate) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ candidate }) => candidate);
}

export function isTailscaleStatusRunning(status: TailscaleStatus | undefined) {
  return status?.BackendState === "Running" && status.Self?.Online !== false;
}

export function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().replace(/\/$/, "")
      : undefined;
  } catch {
    return undefined;
  }
}

export function networkInterfaceFingerprint() {
  const entries: string[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces()).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (isVirtualInterfaceName(name)) continue;
    for (const address of addresses ?? []) {
      if (address.internal) continue;
      entries.push(`${name}|${address.family}|${address.address}`);
    }
  }
  return entries.sort().join("\n");
}

function tailcatBootstrapCandidate() {
  const directAddress = process.env.CODEX_RELAY_TAILCAT_ADDR?.trim();
  const directPort = Number(process.env.CODEX_RELAY_TAILCAT_PORT);
  const status = directAddress?.startsWith("tc")
    ? { address: directAddress, port: directPort }
    : readTailcatStatusFile();
  const address = status?.address?.trim();
  const port = Number(status?.port ?? process.env.CODEX_RELAY_TAILCAT_PORT);
  if (!address?.startsWith("tc") || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }
  const candidate = new URL("http://tailcat.invalid/");
  candidate.searchParams.set("addr", address);
  candidate.searchParams.set("port", String(port));
  candidate.searchParams.set("v", "1");
  return { address, candidateUrl: candidate.toString(), port };
}

function readTailcatStatusFile() {
  const path = process.env.CODEX_RELAY_TAILCAT_STATUS_FILE?.trim();
  if (!path) return undefined;
  try {
    const lines = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const parsed = JSON.parse(lines[index] ?? "") as { address?: string; port?: number };
        if (parsed.address?.startsWith("tc")) return parsed;
      } catch {
        // Ignore helper log fragments until a complete readiness record exists.
      }
    }
  } catch {
    // The helper creates the readiness file asynchronously after launch.
  }
  return undefined;
}

function filterCandidatesForMode(candidates: ConnectUrlCandidate[], mode: ConnectUrlMode) {
  if (mode === "local") return candidates.filter((candidate) => candidate.kind === "lan");
  if (mode === "remote") {
    return candidates.filter(
      (candidate) => candidate.kind === "server" && isMobileReachableServer(candidate.url),
    );
  }
  return candidates;
}

function configuredServerCandidate(listenUrl: string): ConnectUrlCandidate | undefined {
  const url = normalizeUrl(listenUrl);
  if (!url) return undefined;
  const host = parseUrlHost(url);
  if (!host || isLocalhost(host) || isUnspecifiedHost(host) || isTailscaleHost(host)) {
    return undefined;
  }
  return { kind: connectUrlCandidateKind(url), label: "Server", url };
}

function localNetworkConnectUrlCandidates(port: number) {
  const candidates: ConnectUrlCandidate[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces()).sort(
    ([left], [right]) => interfaceRank(left) - interfaceRank(right) || left.localeCompare(right),
  )) {
    if (isVirtualInterfaceName(name)) continue;
    for (const address of addresses ?? []) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        isPrivateIPv4Host(address.address) &&
        !isLinkLocalIPv4Host(address.address) &&
        !isTailscaleIPv4Host(address.address)
      ) {
        candidates.push({ kind: "lan", label: name, url: `http://${address.address}:${port}` });
      }
    }
  }
  return candidates;
}

function connectUrlCandidateRank(candidate: ConnectUrlCandidate) {
  if (candidate.kind === "lan") return 0;
  if (candidate.kind === "tailscale") return 1;
  const host = parseUrlHost(candidate.url);
  if (host && (isLocalhost(host) || isUnspecifiedHost(host))) return 3;
  return 2;
}

function connectUrlCandidateKind(url: string): ConnectUrlCandidateKind {
  const host = parseUrlHost(url);
  if (!host) return "server";
  if (isTailscaleHost(host)) return "tailscale";
  if (
    host.endsWith(".local") ||
    (isPrivateIPv4Host(host) && !isTailscaleIPv4Host(host)) ||
    isLocalIPv6Host(host)
  ) {
    return "lan";
  }
  return "server";
}

function isMobileReachableServer(url: string) {
  const host = parseUrlHost(url);
  return Boolean(host && !isLocalhost(host) && !isUnspecifiedHost(host) && !isTailscaleHost(host));
}

function dedupeCandidates(candidates: ConnectUrlCandidate[]) {
  const deduped = new Map<string, ConnectUrlCandidate>();
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate.url);
    if (url && !deduped.has(url)) deduped.set(url, { ...candidate, url });
  }
  return [...deduped.values()];
}

function compactCandidateHosts(primaryServerUrl: string, serverUrls: string[]) {
  const primary = parseUrl(primaryServerUrl);
  if (!primary) return { fullUrls: [] as string[], hosts: [] as string[] };
  const fullUrls: string[] = [];
  const hosts: string[] = [];
  for (const serverUrl of serverUrls.slice(1)) {
    const candidate = parseUrl(serverUrl);
    if (!candidate) continue;
    if (
      candidate.hostname !== "tailcat.invalid" &&
      candidate.protocol === primary.protocol &&
      candidate.port === primary.port
    ) {
      if (!hosts.includes(candidate.hostname)) hosts.push(candidate.hostname);
      continue;
    }
    if (!fullUrls.includes(serverUrl)) fullUrls.push(serverUrl);
  }
  return { fullUrls, hosts };
}

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function parseUrlHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isLocalhost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isUnspecifiedHost(host: string) {
  return host === "0.0.0.0" || host === "::";
}

function isTailscaleHost(host: string) {
  return (
    host.endsWith(".ts.net") || host.endsWith(".beta.tailscale.net") || isTailscaleIPv4Host(host)
  );
}

function isPrivateIPv4Host(host: string) {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

function isLinkLocalIPv4Host(host: string) {
  const octets = host.split(".").map(Number);
  return octets.length === 4 && octets[0] === 169 && octets[1] === 254;
}

function isTailscaleIPv4Host(host: string) {
  const octets = host.split(".").map(Number);
  return octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

function isLocalIPv6Host(host: string) {
  const normalized = host.replace(/^\[/, "").replace(/\]$/, "");
  return (
    normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")
  );
}

function isVirtualInterfaceName(name: string) {
  return /^(?:awdl|bridge|docker|llw|tap|tailscale|tun|utun|vbox|virbr|vmenet|vmnet|wg)/i.test(
    name,
  );
}

function interfaceRank(name: string) {
  if (/^en0$/i.test(name)) return 0;
  if (/^en\d+$/i.test(name)) return 1;
  if (/^(?:eth|ethernet|wlan|wifi)/i.test(name)) return 2;
  return 3;
}
