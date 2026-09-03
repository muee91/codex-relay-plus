import { serve } from "@hono/node-server";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { Hono } from "hono";
import qrcode from "qrcode-terminal";

import { connect } from "./libsql-database.js";
import type { PairingSessionStore } from "./pairing-store.js";
import type { ConnectUrlCandidate } from "./pairing-url-candidates.js";
import { renderControlCenterPage } from "./control-center-page.js";

export type ControlCenterOptions = {
  authDbPath: string;
  connectUrl: string;
  connectUrlCandidates: ConnectUrlCandidate[];
  pairingPayload: string;
  onPairApproved?: (client: { approvalCode: string; clientName?: string }) => void;
  onPairingsCleared?: (result: { pendingPairingsCleared: number; sessionsCleared: number }) => void;
  port: number;
  relayPort: number;
  sessions: PairingSessionStore;
  sharedAppServerRemoteAddress?: string;
  workspacePath: string;
};

export function startControlCenter(options: ControlCenterOptions) {
  const app = new Hono();
  const controlToken = randomBytes(24).toString("base64url");
  const database = connect(options.authDbPath);
  const pairingQr = renderPairingQr(options.pairingPayload);
  let diagnosticsCache:
    | { expiresAt: number; value: Awaited<ReturnType<typeof collectDiagnostics>> }
    | undefined;

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

  app.get("/api/state", async (c) => {
    const [pendingPairings, sessions, diagnostics] = await Promise.all([
      listPendingPairings(database),
      listSessions(database),
      getDiagnostics(),
    ]);
    return c.json({
      diagnostics,
      pairingPayload: options.pairingPayload,
      pairingQr,
      pendingPairings,
      relay: {
        connectUrl: options.connectUrl,
        connectUrlCandidates: options.connectUrlCandidates,
        pid: process.pid,
        port: options.relayPort,
        sharedAppServerRemoteAddress: options.sharedAppServerRemoteAddress,
        workspacePath: options.workspacePath,
      },
      sessions,
    });
  });

  app.post("/api/pairings/:approvalCode/approve", async (c) => {
    const approvalCode = normalizeApprovalCode(c.req.param("approvalCode"));
    const pending = await options.sessions.approvePendingPairing(approvalCode, Date.now());
    if (!pending) {
      return c.json({ error: "Pairing request was not found or has expired." }, 404);
    }
    options.onPairApproved?.({ approvalCode, clientName: pending.clientName });
    return c.json({ approved: true, approvalCode });
  });

  app.delete("/api/pairings/:approvalCode", async (c) => {
    const approvalCode = normalizeApprovalCode(c.req.param("approvalCode"));
    await options.sessions.deletePendingPairing(approvalCode);
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
    return c.json({ removed: true });
  });

  app.post("/api/sessions/clear", async (c) => {
    const result = await options.sessions.clearAll();
    options.onPairingsCleared?.(result);
    return c.json(result);
  });

  async function getDiagnostics() {
    const now = Date.now();
    if (diagnosticsCache && diagnosticsCache.expiresAt > now) {
      return diagnosticsCache.value;
    }
    const value = await collectDiagnostics(options);
    diagnosticsCache = { expiresAt: now + 30_000, value };
    return value;
  }

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

async function collectDiagnostics(options: ControlCenterOptions) {
  const workspaceReadable = await access(options.workspacePath).then(
    () => true,
    () => false,
  );
  const tailscaleVersion = await readCommandFirstLine("tailscale", ["version"]);
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
      label: "Workspace",
      status: workspaceReadable ? "ok" : "bad",
      value: workspaceReadable ? options.workspacePath : `unavailable · ${options.workspacePath}`,
    },
    {
      label: "Network",
      status: options.connectUrlCandidates.length > 0 ? "ok" : "warn",
      value: `${options.connectUrlCandidates.length || 1} address candidate${
        options.connectUrlCandidates.length === 1 ? "" : "s"
      }`,
    },
    {
      label: "Tailscale",
      status: tailscaleVersion ? "ok" : "warn",
      value: tailscaleVersion ?? "not detected · optional",
    },
  ];
}

function readCommandFirstLine(command: string, args: string[]) {
  return new Promise<string | undefined>((resolve) => {
    execFile(command, args, { encoding: "utf8", timeout: 1500 }, (error, stdout) => {
      if (error) {
        resolve(undefined);
        return;
      }
      resolve(stdout.trim().split(/\r?\n/)[0] || "installed");
    });
  });
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
