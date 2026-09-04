import { execFileSync } from "node:child_process";
import { networkInterfaces } from "node:os";

export type ConnectUrlCandidateKind = "lan" | "tailscale" | "server";
export type ConnectUrlMode = "auto" | "local" | "remote";

export type ConnectUrlCandidate = {
  kind: ConnectUrlCandidateKind;
  label: string;
  url: string;
};

type TailscaleStatus = {
  BackendState?: string;
  Self?: {
    DNSName?: string;
    Online?: boolean;
    TailscaleIPs?: string[];
  };
};

export function getConnectUrlGuidance(url: string) {
  const host = parseUrlHost(url);
  if (!host) {
    return undefined;
  }

  if (isLocalhost(host) || isUnspecifiedHost(host)) {
    return (
      "This address is only reachable from this computer. " +
      "Use a same-Wi-Fi address or a verified remote path for mobile pairing."
    );
  }

  if (isTailscaleHost(host)) {
    return (
      "Using Tailscale. This address is offered only while Tailscale is running " +
      "on this computer; the phone must also be able to reach the tailnet."
    );
  }

  if (isPrivateIPv4Host(host) || isLocalIPv6Host(host) || host.endsWith(".local")) {
    return "Using a local Wi-Fi/LAN address. Keep the phone and computer on the same network.";
  }

  return "Using a configured or public address. Make sure the phone can reach it before pairing.";
}

export function createPairingQrPayload(details: { serverPublicKey: string; serverUrls: string[] }) {
  const primaryServerUrl = details.serverUrls[0];
  if (!primaryServerUrl) {
    throw new Error("Pairing QR requires at least one server URL.");
  }

  const url = new URL("codex-relay://pair");
  url.searchParams.set("serverUrl", primaryServerUrl);
  url.searchParams.set("serverPublicKey", details.serverPublicKey);
  const compacted = compactCandidateHosts(primaryServerUrl, details.serverUrls);
  if (compacted.hosts.length > 0) {
    url.searchParams.set("h", compacted.hosts.join(","));
  }
  if (compacted.fullUrls.length > 0) {
    url.searchParams.set("serverUrls", JSON.stringify(compacted.fullUrls));
  }

  const tailcatAddress = process.env.CODEX_RELAY_TAILCAT_ADDR?.trim();
  const tailcatPort = Number(process.env.CODEX_RELAY_TAILCAT_PORT);
  if (
    tailcatAddress?.startsWith("tc") &&
    Number.isSafeInteger(tailcatPort) &&
    tailcatPort >= 1 &&
    tailcatPort <= 65535
  ) {
    url.searchParams.set("tailcatAddr", tailcatAddress);
    url.searchParams.set("tailcatPort", String(tailcatPort));
    url.searchParams.set("transportVersion", "1");
  }
  return url.toString();
}

export function getConnectUrlCandidates(
  details: { listenUrl: string; port: number },
  options: { mode?: ConnectUrlMode } = {},
) {
  const status = getTailscaleStatus();
  const tailscaleRunning = isTailscaleStatusRunning(status);
  const serverCandidate = configuredServerCandidate(details.listenUrl, tailscaleRunning);
  const candidates = dedupeCandidates([
    ...localNetworkConnectUrlCandidates(details.port),
    ...tailscaleConnectUrlCandidates(details.port, status),
    ...(serverCandidate ? [serverCandidate] : []),
  ]);
  return filterCandidatesForMode(
    prioritizeConnectUrlCandidates(candidates),
    options.mode ?? "auto",
  );
}

export function prioritizeConnectUrlCandidates(candidates: ConnectUrlCandidate[]) {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      rank: connectUrlCandidateRank(candidate),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ candidate }) => candidate);
}

export function isTailscaleStatusRunning(status: TailscaleStatus | undefined) {
  return status?.BackendState === "Running" && status.Self?.Online !== false;
}

export function normalizeUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().replace(/\/$/, "")
      : undefined;
  } catch {
    return undefined;
  }
}

function filterCandidatesForMode(candidates: ConnectUrlCandidate[], mode: ConnectUrlMode) {
  if (mode === "local") {
    return candidates.filter((candidate) => candidate.kind === "lan");
  }
  if (mode === "remote") {
    return candidates.filter(
      (candidate) => candidate.kind === "tailscale" || isMobileReachableServer(candidate.url),
    );
  }
  return candidates;
}

function configuredServerCandidate(
  listenUrl: string,
  tailscaleRunning: boolean,
): ConnectUrlCandidate | undefined {
  const url = normalizeUrl(listenUrl);
  if (!url) {
    return undefined;
  }
  const host = parseUrlHost(url);
  if (!host || isLocalhost(host) || isUnspecifiedHost(host)) {
    return undefined;
  }
  if (isTailscaleHost(host) && !tailscaleRunning) {
    return undefined;
  }
  return {
    kind: connectUrlCandidateKind(url),
    label: "Server",
    url,
  };
}

function tailscaleConnectUrlCandidates(port: number, status: TailscaleStatus | undefined) {
  if (!isTailscaleStatusRunning(status)) {
    return [];
  }

  const candidates: ConnectUrlCandidate[] = [];
  for (const ip of status?.Self?.TailscaleIPs ?? []) {
    if (isTailscaleIPv4Host(ip)) {
      candidates.push({ kind: "tailscale", label: "Tailscale", url: `http://${ip}:${port}` });
    }
  }

  const dnsName = status?.Self?.DNSName?.replace(/\.$/, "");
  if (dnsName) {
    const servedUrl = getTailscaleServeHttpsUrl(dnsName, port);
    candidates.push({
      kind: "tailscale",
      label: servedUrl ? "Tailscale Serve" : "Tailscale DNS",
      url: servedUrl ?? `http://${dnsName}:${port}`,
    });
  }

  return candidates;
}

function localNetworkConnectUrlCandidates(port: number) {
  const candidates: ConnectUrlCandidate[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces()).sort(
    ([left], [right]) => interfaceRank(left) - interfaceRank(right) || left.localeCompare(right),
  )) {
    if (isVirtualInterfaceName(name)) {
      continue;
    }
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
  if (candidate.kind === "lan") {
    return 0;
  }
  if (candidate.kind === "tailscale") {
    return 1;
  }
  const host = parseUrlHost(candidate.url);
  if (host && (isLocalhost(host) || isUnspecifiedHost(host))) {
    return 3;
  }
  return 2;
}

function connectUrlCandidateKind(url: string): ConnectUrlCandidateKind {
  const host = parseUrlHost(url);
  if (!host) {
    return "server";
  }
  if (isTailscaleHost(host)) {
    return "tailscale";
  }
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
  return Boolean(host && !isLocalhost(host) && !isUnspecifiedHost(host));
}

function dedupeCandidates(candidates: ConnectUrlCandidate[]) {
  const deduped = new Map<string, ConnectUrlCandidate>();
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate.url);
    if (url && !deduped.has(url)) {
      deduped.set(url, { ...candidate, url });
    }
  }
  return [...deduped.values()];
}

function compactCandidateHosts(primaryServerUrl: string, serverUrls: string[]) {
  const primary = parseUrl(primaryServerUrl);
  if (!primary) {
    return { fullUrls: [] as string[], hosts: [] as string[] };
  }

  const fullUrls: string[] = [];
  const hosts: string[] = [];
  for (const serverUrl of serverUrls.slice(1)) {
    const candidate = parseUrl(serverUrl);
    if (!candidate) {
      continue;
    }
    if (candidate.protocol === primary.protocol && candidate.port === primary.port) {
      if (!hosts.includes(candidate.hostname)) {
        hosts.push(candidate.hostname);
      }
      continue;
    }
    if (!fullUrls.includes(serverUrl)) {
      fullUrls.push(serverUrl);
    }
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
  if (/^en0$/i.test(name)) {
    return 0;
  }
  if (/^en\d+$/i.test(name)) {
    return 1;
  }
  if (/^(?:eth|ethernet|wlan|wifi)/i.test(name)) {
    return 2;
  }
  return 3;
}

function getTailscaleStatus() {
  try {
    const output = execFileSync("tailscale", ["status", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });
    return JSON.parse(output) as TailscaleStatus;
  } catch {
    return undefined;
  }
}

function getTailscaleServeHttpsUrl(dnsName: string, port: number) {
  try {
    const output = execFileSync("tailscale", ["serve", "status", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });
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
