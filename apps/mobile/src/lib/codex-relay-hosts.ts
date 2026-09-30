import {
  codexRelayStorage,
  restoreCodexRelayConnectionState,
  snapshotCodexRelayConnectionState,
  type CodexRelayConnectionSnapshot,
} from "./codex-relay-server-url-storage";
import {
  getActiveCodexRelayHostId as readActiveCodexRelayHostId,
  hostStorage,
  setActiveCodexRelayHostId,
} from "./codex-relay-active-host";
import {
  restoreSecureSession,
  snapshotSecureSession,
  type SecureSessionSnapshot,
} from "./secure-transport";

const hostsStorageKey = "hosts-v1";
const clientTokenStorageKey = "codex-relay.client-token";
const legacyClientTokenExpiresAtStorageKey = "codex-relay.client-token-expires-at";

export type CodexRelayHostRecord = {
  clientToken: string;
  connection: CodexRelayConnectionSnapshot;
  id: string;
  lastUsedAt: string;
  name: string;
  secureSession?: SecureSessionSnapshot;
};

export function listCodexRelayHosts() {
  return readHosts()
    .slice()
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
}

export function getActiveCodexRelayHostId() {
  return readActiveCodexRelayHostId();
}

export function ensureCurrentCodexRelayHost(displayName?: string) {
  const clientToken = codexRelayStorage.getString(clientTokenStorageKey);
  if (!clientToken) {
    return undefined;
  }

  const hosts = readHosts();
  const activeId = getActiveCodexRelayHostId();
  const current =
    (activeId ? hosts.find((host) => host.id === activeId) : undefined) ??
    hostRecordForCurrentSession(deriveLegacyHostId(), displayName);

  const next = snapshotHost({
    ...current,
    name: normalizedHostName(displayName) ?? current.name,
  });
  writeHost(next);
  setActiveCodexRelayHostId(next.id);
  return next;
}

export function persistActiveCodexRelayHost(displayName?: string) {
  const activeId = getActiveCodexRelayHostId();
  const clientToken = codexRelayStorage.getString(clientTokenStorageKey);
  if (!clientToken) {
    return undefined;
  }

  const current =
    (activeId ? readHosts().find((host) => host.id === activeId) : undefined) ??
    hostRecordForCurrentSession(deriveLegacyHostId(), displayName);
  const next = snapshotHost({
    ...current,
    name: normalizedHostName(displayName) ?? current.name,
  });
  writeHost(next);
  setActiveCodexRelayHostId(next.id);
  return next;
}

export function registerPairedCodexRelayHost(input: {
  displayName?: string;
  serverPublicKey: string;
}) {
  const id = `server:${input.serverPublicKey}`;
  const existing = readHosts().find((host) => host.id === id);
  const base =
    existing ??
    hostRecordForCurrentSession(
      id,
      normalizedHostName(input.displayName) ?? defaultHostName(snapshotCodexRelayConnectionState()),
    );
  const next = snapshotHost({
    ...base,
    id,
    name: normalizedHostName(input.displayName) ?? base.name,
  });
  writeHost(next);
  setActiveCodexRelayHostId(id);
  return next;
}

export function activateCodexRelayHost(id: string) {
  const target = readHosts().find((host) => host.id === id);
  if (!target) {
    throw new Error("Saved Codex Relay host was not found.");
  }

  if (getActiveCodexRelayHostId() !== id && codexRelayStorage.getString(clientTokenStorageKey)) {
    persistActiveCodexRelayHost();
  }

  restoreCodexRelayConnectionState(target.connection);
  restoreSecureSession(target.secureSession);
  codexRelayStorage.set(clientTokenStorageKey, target.clientToken);
  codexRelayStorage.remove(legacyClientTokenExpiresAtStorageKey);

  const activated = {
    ...target,
    lastUsedAt: new Date().toISOString(),
  };
  writeHost(activated);
  setActiveCodexRelayHostId(id);
  return activated;
}

export function updateActiveCodexRelayHostName(name: string | undefined) {
  const normalized = normalizedHostName(name);
  const activeId = getActiveCodexRelayHostId();
  if (!normalized || !activeId) {
    return;
  }

  const host = readHosts().find((candidate) => candidate.id === activeId);
  if (!host || host.name === normalized) {
    return;
  }
  writeHost({ ...host, name: normalized });
}

export function forgetActiveCodexRelayHost() {
  const activeId = getActiveCodexRelayHostId();
  if (!activeId) {
    return;
  }
  writeHosts(readHosts().filter((host) => host.id !== activeId));
  setActiveCodexRelayHostId(undefined);
}

function snapshotHost(host: CodexRelayHostRecord): CodexRelayHostRecord {
  const clientToken = codexRelayStorage.getString(clientTokenStorageKey);
  if (!clientToken) {
    throw new Error("Cannot save a Codex Relay host without an active session.");
  }

  return {
    ...host,
    clientToken,
    connection: snapshotCodexRelayConnectionState(),
    lastUsedAt: new Date().toISOString(),
    secureSession: snapshotSecureSession(),
  };
}

function hostRecordForCurrentSession(id: string, displayName?: string): CodexRelayHostRecord {
  const clientToken = codexRelayStorage.getString(clientTokenStorageKey);
  if (!clientToken) {
    throw new Error("Cannot create a Codex Relay host without an active session.");
  }
  const connection = snapshotCodexRelayConnectionState();
  return {
    clientToken,
    connection,
    id,
    lastUsedAt: new Date().toISOString(),
    name: normalizedHostName(displayName) ?? defaultHostName(connection),
    secureSession: snapshotSecureSession(),
  };
}

function deriveLegacyHostId() {
  const connection = snapshotCodexRelayConnectionState();
  if (connection.tailcatBootstrap?.address) {
    return `tailcat:${connection.tailcatBootstrap.address}`;
  }
  if (connection.serverUrl) {
    return `url:${connection.serverUrl}`;
  }
  return "legacy-current";
}

function defaultHostName(connection: CodexRelayConnectionSnapshot) {
  const candidates = [connection.serverUrl, ...connection.serverUrlCandidates].filter(
    (value): value is string => Boolean(value),
  );
  for (const value of candidates) {
    try {
      const hostname = new URL(value).hostname;
      if (
        hostname &&
        hostname !== "127.0.0.1" &&
        hostname !== "localhost" &&
        hostname !== "tailcat.invalid"
      ) {
        return hostname;
      }
    } catch {
      continue;
    }
  }
  return "Codex Relay Host";
}

function normalizedHostName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function writeHost(host: CodexRelayHostRecord) {
  const hosts = readHosts();
  const next = hosts.some((candidate) => candidate.id === host.id)
    ? hosts.map((candidate) => (candidate.id === host.id ? host : candidate))
    : [...hosts, host];
  writeHosts(next);
}

function readHosts(): CodexRelayHostRecord[] {
  const raw = hostStorage.getString(hostsStorageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isHostRecord);
  } catch {
    return [];
  }
}

function writeHosts(hosts: CodexRelayHostRecord[]) {
  hostStorage.set(hostsStorageKey, JSON.stringify(hosts));
}

function isHostRecord(value: unknown): value is CodexRelayHostRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const host = value as Partial<CodexRelayHostRecord>;
  return Boolean(
    typeof host.id === "string" &&
    host.id &&
    typeof host.name === "string" &&
    host.name &&
    typeof host.clientToken === "string" &&
    host.clientToken &&
    typeof host.lastUsedAt === "string" &&
    host.connection &&
    typeof host.connection === "object",
  );
}
