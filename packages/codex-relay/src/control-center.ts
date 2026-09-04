import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import qrcode from "qrcode-terminal";

import type { AppServerThread } from "./app-server.js";
import { renderControlCenterPage } from "./control-center-page.js";
import { connect } from "./libsql-database.js";
import type { RelayNetworkState } from "./network-state.js";
import type { PairingSessionStore } from "./pairing-store.js";

export type ControlCenterOptions = {
  authDbPath: string;
  getNetworkState: () => RelayNetworkState;
  listThreads?: () => Promise<AppServerThread[]>;
  onPairApproved?: (client: { approvalCode: string; clientName?: string }) => void;
  onPairingsCleared?: (result: { pendingPairingsCleared: number; sessionsCleared: number }) => void;
  port: number;
  refreshNetworkState?: () => Promise<RelayNetworkState>;
  relayPort: number;
  sessions: PairingSessionStore;
  sharedAppServerRemoteAddress?: string;
  workspacePath: string;
};

type PendingPairingSummary = {
  approvalCode: string;
  clientName?: string;
  expiresAt: number;
  serverUrl: string;
};

type SessionSummary = {
  clientName?: string;
  clientSessionId?: string;
  createdAt: number;
  displayId: string;
  tokenHash: string;
  updatedAt: number;
};

type ThreadSummary = {
  cwd: string;
  id: string;
  name?: string;
  preview: string;
  source: string;
  status: string;
  updatedAt: number;
};

type DeviceSnapshot = {
  pendingPairings: PendingPairingSummary[];
  sessions: SessionSummary[];
  updatedAt: number;
};

type ThreadSnapshot = {
  threads: ThreadSummary[];
  updatedAt: number;
};

export function startControlCenter(options: ControlCenterOptions) {
  const app = new Hono();
  const controlToken = randomBytes(24).toString("base64url");
  const database = connect(options.authDbPath);
  let deviceSnapshot: DeviceSnapshot = { pendingPairings: [], sessions: [], updatedAt: 0 };
  let threadSnapshot: ThreadSnapshot = { threads: [], updatedAt: 0 };
  let snapshotRefresh: Promise<void> | undefined;
  let threadRefresh: Promise<void> | undefined;
  let qrGeneration = -1;
  let pairingQr = "";

  const refreshDeviceSnapshot = () => {
    if (snapshotRefresh) {
      return snapshotRefresh;
    }
    snapshotRefresh = Promise.all([listPendingPairings(database), listSessions(database)])
      .then(([pendingPairings, sessions]) => {
        deviceSnapshot = { pendingPairings, sessions, updatedAt: Date.now() };
      })
      .catch((error) => {
        console.error(
          `Codex Relay control center device snapshot failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      })
      .finally(() => {
        snapshotRefresh = undefined;
      });
    return snapshotRefresh;
  };

  const refreshThreadSnapshot = () => {
    if (!options.listThreads) {
      return Promise.resolve();
    }
    if (threadRefresh) {
      return threadRefresh;
    }
    threadRefresh = options
      .listThreads()
      .then((threads) => {
        threadSnapshot = {
          threads: threads.slice(0, 30).map(summarizeThread),
          updatedAt: Date.now(),
        };
      })
      .catch((error) => {
        console.error(
          `Codex Relay control center thread snapshot failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      })
      .finally(() => {
        threadRefresh = undefined;
      });
    return threadRefresh;
  };

  void refreshDeviceSnapshot();
  void refreshThreadSnapshot();

  app.use("*", async (c, next) => {
    if (!isAllowedControlHost(c.req.header("host"), options.port)) {
      return c.text("Invalid control-center host.", 403);
    }
    c.header("cache-control", "no-store");
    c.header("referrer-policy", "no-referrer");
    c.header("x-content-type-options", "nosniff");
    c.header("x-frame-options", "DENY");
    c.header(
      "content-security-policy",
      [
        "default-src 'self'",
        "style-src 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
      ].join("; "),
    );
    await next();
  });

  app.get("/", (c) => c.html(renderControlCenterPage(controlToken)));

  app.use("/api/*", async (c, next) => {
    if (c.req.header("x-codex-relay-control-token") !== controlToken) {
      return c.json({ error: "Unauthorized control-center request." }, 401);
    }
    await next();
  });

  app.get("/api/state", (c) => {
    void refreshDeviceSnapshot();
    if (!threadSnapshot.updatedAt || Date.now() - threadSnapshot.updatedAt > 3000) {
      void refreshThreadSnapshot();
    }
    const network = options.getNetworkState();
    if (network.generation !== qrGeneration) {
      qrGeneration = network.generation;
      pairingQr = renderPairingQr(network.pairingPayload);
    }
    return c.json({
      diagnostics: collectCoreDiagnostics(options, network),
      network,
      pairingPayload: network.pairingPayload,
      pairingQr,
      pendingPairings: deviceSnapshot.pendingPairings,
      relay: {
        connectUrl: network.connectUrl,
        connectUrlCandidates: network.connectUrlCandidates,
        pid: process.pid,
        port: options.relayPort,
        sharedAppServerRemoteAddress: options.sharedAppServerRemoteAddress,
        workspacePath: options.workspacePath,
      },
      sessions: deviceSnapshot.sessions,
      snapshotUpdatedAt: Math.max(deviceSnapshot.updatedAt, threadSnapshot.updatedAt),
      threads: threadSnapshot.threads,
    });
  });

  app.post("/api/network/refresh", async (c) => {
    const network = options.refreshNetworkState
      ? await options.refreshNetworkState()
      : options.getNetworkState();
    return c.json({ network });
  });

  app.post("/api/pairings/:approvalCode/approve", async (c) => {
    const approvalCode = normalizeApprovalCode(c.req.param("approvalCode"));
    const pending = await options.sessions.approvePendingPairing(approvalCode, Date.now());
    if (!pending) {
      return c.json({ error: "Pairing request was not found or has expired." }, 404);
    }
    options.onPairApproved?.({ approvalCode, clientName: pending.clientName });
    void refreshDeviceSnapshot();
    return c.json({ approved: true, approvalCode });
  });

  app.delete("/api/pairings/:approvalCode", async (c) => {
    const approvalCode = normalizeApprovalCode(c.req.param("approvalCode"));
    await options.sessions.deletePendingPairing(approvalCode);
    void refreshDeviceSnapshot();
    return c.json({ removed: true, approvalCode });
  });

  app.delete("/api/sessions/:tokenHash", async (c) => {
    const tokenHash = c.req.param("tokenHash");
    const row = await database
      .prepare(
        "SELECT client_session_id AS clientSessionId FROM pairing_sessions WHERE token_hash = ?",
      )
      .get(tokenHash);
    await options.sessions.deleteSession(tokenHash);
    if (typeof row?.clientSessionId === "string") {
      await options.sessions.deletePushNotificationSubscription(row.clientSessionId);
    }
    void refreshDeviceSnapshot();
    return c.json({ removed: true });
  });

  app.post("/api/sessions/clear", async (c) => {
    const result = await options.sessions.clearAll();
    options.onPairingsCleared?.(result);
    deviceSnapshot = { pendingPairings: [], sessions: [], updatedAt: Date.now() };
    return c.json(result);
  });

  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port });
  server.on("error", (error) => {
    console.error(`Codex Relay control center failed: ${error.message}`);
  });
  return server;
}

async function listPendingPairings(database: ReturnType<typeof connect>) {
  const rows = await database
    .prepare(
      `SELECT approval_code AS approvalCode,
              client_name AS clientName,
              expires_at AS expiresAt,
              server_url AS serverUrl
       FROM pending_pairings
       WHERE approved = 0 AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .all(Date.now());
  return rows.map((row) => ({
    approvalCode: String(row.approvalCode),
    clientName: typeof row.clientName === "string" ? row.clientName : undefined,
    expiresAt: Number(row.expiresAt),
    serverUrl: String(row.serverUrl),
  }));
}

async function listSessions(database: ReturnType<typeof connect>) {
  const rows = await database
    .prepare(
      `SELECT token_hash AS tokenHash,
              client_session_id AS clientSessionId,
              client_name AS clientName,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM pairing_sessions
       ORDER BY updated_at DESC`,
    )
    .all();
  return rows.map((row) => {
    const tokenHash = String(row.tokenHash);
    return {
      clientName: typeof row.clientName === "string" ? row.clientName : undefined,
      clientSessionId: typeof row.clientSessionId === "string" ? row.clientSessionId : undefined,
      createdAt: Number(row.createdAt),
      displayId: tokenHash.slice(0, 12),
      tokenHash,
      updatedAt: Number(row.updatedAt),
    };
  });
}

function summarizeThread(thread: AppServerThread): ThreadSummary {
  const status = normalizeThreadStatus(thread.status);
  return {
    cwd: thread.cwd,
    id: thread.id,
    name: thread.name?.trim() || undefined,
    preview: thread.preview?.trim() || "",
    source: thread.source,
    status,
    updatedAt: thread.recencyAt ?? thread.updatedAt ?? thread.createdAt,
  };
}

function normalizeThreadStatus(status: unknown) {
  if (typeof status === "string") {
    return status;
  }
  if (status && typeof status === "object") {
    if ("type" in status && typeof (status as { type?: unknown }).type === "string") {
      return (status as { type: string }).type;
    }
    if ("status" in status && typeof (status as { status?: unknown }).status === "string") {
      return (status as { status: string }).status;
    }
  }
  return "idle";
}

function collectCoreDiagnostics(options: ControlCenterOptions, network: RelayNetworkState) {
  const nodeVersion = process.versions.node;
  const nodeParts = nodeVersion.split(".").map(Number);
  const nodeSupported =
    nodeParts[0] > 22 ||
    (nodeParts[0] === 22 && (nodeParts[1] > 14 || (nodeParts[1] === 14 && nodeParts[2] >= 0)));
  return [
    {
      label: "Relay",
      status: "ok",
      value: `127.0.0.1:${options.relayPort} · PID ${process.pid}`,
    },
    {
      label: "Node.js",
      status: nodeSupported ? "ok" : "bad",
      value: `v${nodeVersion}${nodeSupported ? "" : " · requires >= 22.14"}`,
    },
    {
      label: "LAN",
      status: network.connectUrlCandidates.some((candidate) => candidate.kind === "lan")
        ? "ok"
        : "warn",
      value: network.connectUrlCandidates.some((candidate) => candidate.kind === "lan")
        ? "local address available"
        : "not currently available",
    },
    {
      label: "Tailcat",
      status: network.tailcat.available ? "ok" : "warn",
      value: network.tailcat.available
        ? `remote transport ready · ${network.tailcat.version}`
        : network.tailcat.error || "remote transport unavailable",
    },
    {
      label: "Codex",
      status: options.sharedAppServerRemoteAddress ? "ok" : "warn",
      value: options.sharedAppServerRemoteAddress
        ? `shared app-server · ${options.sharedAppServerRemoteAddress}`
        : "private app-server fallback",
    },
  ];
}

function renderPairingQr(payload: string) {
  let output = "";
  qrcode.generate(payload, { small: true }, (generated) => {
    output = generated;
  });
  return output;
}

function normalizeApprovalCode(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replaceAll("O", "0")
    .replaceAll("I", "1");
  return normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}

function isAllowedControlHost(host: string | undefined, port: number) {
  if (!host) {
    return false;
  }
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`, "127.0.0.1", "localhost"]).has(
    host.toLowerCase(),
  );
}
