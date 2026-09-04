import { serve } from "@hono/node-server";
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import qrcode from "qrcode-terminal";

import { createApp } from "./app.js";
import { createServerIdentity, createServerIdentityFromPrivateKey } from "./auth.js";
import { startRelayAppServer } from "./app-server.js";
import { color } from "./cli-colors.js";
import {
  formatApprovalCommand,
  getControlCenterPort,
  getRelayPort,
  isControlCenterEnabled,
  npxCommand,
} from "./cli.js";
import { startControlCenter } from "./control-center.js";
import {
  codexRelayDataPath,
  legacyCodexRelayDataPath,
  prepareCodexRelayDataDirectory,
} from "./data-paths.js";
import { relayDebugLog, resolveRelayDebugLogPath } from "./debug-log.js";
import { getConnectUrlGuidance } from "./lan-address.js";
import {
  NetworkStateManager,
  type ConnectUrlCandidate,
  type NetworkStateSnapshot,
} from "./network-state-manager.js";
import { PairingSessionStore } from "./pairing-store.js";
import { PreferencesStore } from "./preferences-store.js";
import { resolveCodexSharedAppServerRemoteAddress } from "./runtime-paths.js";
import { fromByteArray, toByteArray } from "./utils/base64.js";

await prepareCodexRelayDataDirectory();

const port = getRelayPort();
const hostname = process.env.CODEX_RELAY_HOST ?? "0.0.0.0";
const dangerouslyAutoApprove = process.env.CODEX_RELAY_AUTO_APPROVE === "1";
const authDbPath = await prepareCodexRelayDataPath("relay-auth.db", [
  "relay-auth.db-shm",
  "relay-auth.db-wal",
]);
const sessionStore = new PairingSessionStore(authDbPath);
const preferencesStore = new PreferencesStore(authDbPath);
const approvalSecret = await getApprovalSecret();
const serverIdentity = await getServerIdentity();
const relayAppServer = await startRelayAppServer();
const debugLogPath = resolveRelayDebugLogPath();
const controlCenterEnabled = isControlCenterEnabled();
const controlPort = getControlCenterPort(port);
const controlTokenPath = process.env.CODEX_RELAY_CONTROL_TOKEN_FILE;

if (relayAppServer) {
  process.once("SIGINT", () => stopRelayAppServer(130));
  process.once("SIGTERM", () => stopRelayAppServer(143));
  process.once("exit", () => relayAppServer.close());
}

serve(
  {
    fetch: createApp({
      appServer: relayAppServer,
      pairing: {
        approvalSecret,
        dangerouslyAutoApprove,
        serverIdentity,
        createClientToken: () => randomBytes(32).toString("base64url"),
        hashClientToken,
        sessions: sessionStore,
        onPaired: ({ clientName, tokenCount }) => {
          const name = clientName ? ` from ${clientName}` : "";
          logRuntimeEvent(
            "Paired",
            `Mobile client connected${name}; ${formatClientCount(tokenCount)} active.`,
          );
        },
        onPairAttempt: ({ remoteAddress }) => {
          logRuntimeEvent(
            "Pairing",
            `Handshake received${remoteAddress ? ` from ${remoteAddress}` : ""}.`,
          );
        },
        onPairApprovalRequested: ({ clientName }) => {
          const name = clientName ? ` from ${clientName}` : "";
          logRuntimeEvent(
            "Approval",
            `Pairing approval requested${name}. Approve it from the local control center or with the CLI code.`,
          );
        },
        onPairApproved: ({ clientName }) => {
          const name = clientName ? ` for ${clientName}` : "";
          logRuntimeEvent(
            "Approved",
            `Pairing request approved${name}. Waiting for secure session pickup.`,
          );
        },
        onPairingsCleared: ({ pendingPairingsCleared, sessionsCleared }) => {
          logRuntimeEvent(
            "Cleared",
            `Signed out ${sessionsCleared} mobile session${
              sessionsCleared === 1 ? "" : "s"
            } and removed ${pendingPairingsCleared} pending pairing request${
              pendingPairingsCleared === 1 ? "" : "s"
            }.`,
          );
        },
        onTokenRefreshed: ({ clientName, tokenCount }) => {
          const name = clientName ? ` for ${clientName}` : "";
          logRuntimeEvent(
            "Refreshed",
            `Mobile session rotated${name}; ${formatClientCount(tokenCount)} active.`,
          );
        },
      },
      preferences: preferencesStore,
    }).fetch,
    hostname,
    port,
  },
  (info) => {
    const listenUrl = `http://${info.address}:${info.port}`;
    const networkState = new NetworkStateManager({
      listenUrl,
      port: info.port,
      serverPublicKey: serverIdentity.publicKey,
    }).start();
    const sharedAppServerRemoteAddress =
      relayAppServer?.appServerMode === "socket"
        ? resolveCodexSharedAppServerRemoteAddress()
        : undefined;
    const controlUrl = controlCenterEnabled ? `http://127.0.0.1:${controlPort}` : undefined;
    const current = networkState.snapshot();

    const persistNetworkState = (snapshot: NetworkStateSnapshot) =>
      writeServerState({
        ...snapshot,
        controlUrl,
        host: hostname,
        listenUrl,
        port: info.port,
      });
    networkState.subscribe((snapshot) => {
      void persistNetworkState(snapshot);
      relayDebugLog("relay.network.changed", {
        connectUrl: snapshot.connectUrl,
        connectUrlCandidates: snapshot.connectUrlCandidates,
        tailscaleCheckedAt: snapshot.tailscale.checkedAt,
      });
    });
    process.once("exit", () => networkState.stop());

    if (controlCenterEnabled) {
      startControlCenter({
        authDbPath,
        controlTokenPath,
        getNetworkState: () => networkState.snapshot(),
        onPairApproved: ({ clientName }) => {
          const name = clientName ? ` for ${clientName}` : "";
          logRuntimeEvent(
            "Approved",
            `Pairing request approved${name} from the desktop control center.`,
          );
        },
        onPairingsCleared: ({ pendingPairingsCleared, sessionsCleared }) => {
          logRuntimeEvent(
            "Cleared",
            `Desktop control center signed out ${sessionsCleared} mobile session${
              sessionsCleared === 1 ? "" : "s"
            } and removed ${pendingPairingsCleared} pending pairing request${
              pendingPairingsCleared === 1 ? "" : "s"
            }.`,
          );
        },
        port: controlPort,
        relayPort: info.port,
        sessions: sessionStore,
        sharedAppServerRemoteAddress,
        workspacePath: process.env.CODEX_RELAY_WORKSPACE_PATH ?? process.cwd(),
      });
    }

    void persistNetworkState(current);
    void writeBackgroundPid();
    if (debugLogPath) {
      logRuntimeEvent("Debug", `Writing diagnostics to ${debugLogPath}`);
      relayDebugLog("relay.started", {
        connectUrl: current.connectUrl,
        connectUrlCandidates: current.connectUrlCandidates,
        controlUrl,
        listenUrl,
        port: info.port,
        workspacePath: process.env.CODEX_RELAY_WORKSPACE_PATH ?? process.cwd(),
      });
    }
    console.log("");
    qrcode.generate(current.pairingPayload, { small: true });
    console.log(
      formatStartupInstructions({
        connectUrl: current.connectUrl,
        connectUrlCandidates: current.connectUrlCandidates,
        controlUrl,
        dangerouslyAutoApprove,
        listenUrl,
        pairingPayload: current.pairingPayload,
        port: info.port,
        sharedAppServerRemoteAddress,
      }),
    );
  },
);

function stopRelayAppServer(exitCode: number) {
  relayAppServer?.close();
  process.exit(exitCode);
}

function formatStartupInstructions(details: {
  connectUrl: string;
  connectUrlCandidates: ConnectUrlCandidate[];
  controlUrl?: string;
  dangerouslyAutoApprove: boolean;
  listenUrl: string;
  pairingPayload: string;
  port: number;
  sharedAppServerRemoteAddress?: string;
}) {
  const localApprovalCommand = color.command(formatApprovalCommand("<code>", details.port));
  const approvalHint = details.controlUrl
    ? `${color.prompt("›")} Approve devices in ${color.url(details.controlUrl)} or with ${localApprovalCommand}`
    : `${color.prompt("›")} Approve a device with ${localApprovalCommand}`;
  const lines = [
    `${color.prompt("›")} Scan the QR code above to pair ${color.brand("Codex Relay mobile")}.`,
    "",
    `${color.prompt("›")} Mobile: ${color.url(details.connectUrl)}`,
    ...formatConnectUrlGuidance(details.connectUrl),
    ...formatConnectUrlCandidates(details.connectUrlCandidates),
    `${color.prompt("›")} Server: ${color.muted(details.listenUrl)}`,
    ...(details.controlUrl
      ? [`${color.prompt("›")} Desktop: ${color.url(details.controlUrl)}`]
      : []),
    "",
    `${color.prompt("›")} Pairing: ${color.url(details.pairingPayload)}`,
    ...(details.sharedAppServerRemoteAddress
      ? [
          "",
          `${color.prompt("›")} Terminal: ${color.command(
            `codex resume --remote ${details.sharedAppServerRemoteAddress}`,
          )}`,
          `  ${color.muted(
            "Connect through the shared Codex app-server to follow and steer the same live sessions.",
          )}`,
        ]
      : []),
    "",
    `${color.prompt("›")} Commands`,
    `  ${color.command(npxCommand)}              Start and print a pairing QR`,
    `  ${color.command(`${npxCommand} desktop`)}      Open the desktop control center`,
    `  ${color.command(`${npxCommand} --bg`)}         Start in the background`,
    `  ${color.command(`${npxCommand} stop`)}         Stop the background relay`,
    `  ${color.command(`${npxCommand} qr`)}           Print this QR again`,
    `  ${color.command(`${npxCommand} approve <code>`)} Approve a device`,
    "",
    details.dangerouslyAutoApprove
      ? `${color.prompt("›")} Pairing requests will be auto-approved.`
      : `${color.prompt("›")} Waiting for pairing requests`,
    details.dangerouslyAutoApprove
      ? `${color.prompt("›")} Disable this for normal use.`
      : approvalHint,
  ];
  return ["", ...lines, ""].join("\n");
}

function formatConnectUrlGuidance(connectUrl: string) {
  const guidance = getConnectUrlGuidance(connectUrl);
  return guidance ? [`${color.prompt("›")} Network: ${guidance}`] : [];
}

function formatConnectUrlCandidates(candidates: ConnectUrlCandidate[]) {
  if (candidates.length <= 1) {
    return [];
  }

  return [
    `${color.prompt("›")} QR includes ${
      candidates.length
    } candidate addresses; the app will use the first reachable one.`,
    ...candidates
      .slice(1)
      .map((candidate) => `  ${color.muted(candidate.label)} ${color.url(candidate.url)}`),
  ];
}

function logRuntimeEvent(label: string, message: string) {
  console.log(`${color.prompt("›")} ${color.event(label.padEnd(8))} ${message}`);
}

function formatClientCount(tokenCount: number) {
  return `${tokenCount} client${tokenCount === 1 ? "" : "s"}`;
}

function hashClientToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

async function getApprovalSecret() {
  if (process.env.CODEX_RELAY_APPROVAL_SECRET) {
    return process.env.CODEX_RELAY_APPROVAL_SECRET;
  }

  const path = await prepareCodexRelayDataPath("approval-secret");
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    const secret = randomBytes(32).toString("base64url");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${secret}\n`, { mode: 0o600 });
    return secret;
  }
}

async function getServerIdentity(): Promise<ServerIdentity> {
  const path = await prepareCodexRelayDataPath("server-identity-key");
  try {
    return createServerIdentityFromPrivateKey(toByteArray((await readFile(path, "utf8")).trim()));
  } catch {
    const identity = createServerIdentity();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${fromByteArray(identity.privateKey)}\n`, { mode: 0o600 });
    return identity;
  }
}

async function writeServerState(
  details: NetworkStateSnapshot & {
    controlUrl?: string;
    host: string;
    listenUrl: string;
    port: number;
  },
) {
  const path = codexRelayDataPath("server-state.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(details)}\n`, { mode: 0o600 });
}

async function prepareCodexRelayDataPath(fileName: string, companionFileNames: string[] = []) {
  const targetPath = codexRelayDataPath(fileName);
  const legacyPath = legacyCodexRelayDataPath(fileName);
  if (targetPath !== legacyPath) {
    await copyLegacyFileIfTargetMissing(legacyPath, targetPath);
    for (const companionFileName of companionFileNames) {
      await copyLegacyFileIfTargetMissing(
        legacyCodexRelayDataPath(companionFileName),
        codexRelayDataPath(companionFileName),
      );
    }
  }
  return targetPath;
}

async function copyLegacyFileIfTargetMissing(sourcePath: string, targetPath: string) {
  try {
    await readFile(targetPath);
    return;
  } catch {}

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  } catch {}
}

async function writeBackgroundPid() {
  if (process.env.CODEX_RELAY_BACKGROUND_CHILD !== "1") {
    return;
  }
  const pidFile = codexRelayDataPath("relay.pid");
  await writeFile(pidFile, `${process.pid}\n`, { mode: 0o600 });
}
