import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/debug-log.js", () => ({
  relayDebugLog: vi.fn(),
}));

import { CodexAppServerClient } from "../src/app-server.js";

type JsonRpcRequest = {
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};

const socketTempRoot = process.platform === "darwin" ? "/tmp" : tmpdir();

describe("CodexAppServerClient thread lifecycle primitives", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses native fork, steer, compact, and delete methods", async () => {
    const codexHome = await mkdtemp(join(socketTempRoot, "codex-relay-lifecycle-"));
    const socketPath = join(codexHome, "app-server-control", "app-server-control.sock");
    const server = await startSharedSocketServer(socketPath, (request) => {
      if (request.method === "thread/fork") {
        return { thread: { id: "forked-thread", turns: [] } };
      }
      if (request.method === "turn/steer") {
        return { turnId: "turn-active" };
      }
      return {};
    });
    vi.stubEnv("CODEX_HOME", codexHome);
    vi.stubEnv("CODEX_RELAY_APP_SERVER_MODE", "socket");
    const client = new CodexAppServerClient({
      startSharedServer: async () => {
        throw new Error("Expected the client to attach to the existing shared app-server.");
      },
    });

    try {
      const forked = await client.forkThread({
        beforeTurnId: "turn-boundary",
        excludeTurns: true,
        threadId: "source-thread",
      });
      const steeredTurnId = await client.steerTurn({
        clientUserMessageId: "client-message",
        expectedTurnId: "turn-active",
        input: [{ type: "text", text: "Focus on the failing tests.", text_elements: [] }],
        threadId: "forked-thread",
      });
      await client.compactThread({ threadId: "forked-thread" });
      await client.deleteThread({ threadId: "forked-thread" });

      expect(forked.id).toBe("forked-thread");
      expect(steeredTurnId).toBe("turn-active");
      expect(requestFor(server.requests, "thread/fork")?.params).toEqual({
        beforeTurnId: "turn-boundary",
        excludeTurns: true,
        threadId: "source-thread",
      });
      expect(requestFor(server.requests, "turn/steer")?.params).toEqual({
        clientUserMessageId: "client-message",
        expectedTurnId: "turn-active",
        input: [{ type: "text", text: "Focus on the failing tests.", text_elements: [] }],
        threadId: "forked-thread",
      });
      expect(requestFor(server.requests, "thread/compact/start")?.params).toEqual({
        threadId: "forked-thread",
      });
      expect(requestFor(server.requests, "thread/delete")?.params).toEqual({
        threadId: "forked-thread",
      });
    } finally {
      client.close();
      await server.close();
      await rm(codexHome, { force: true, recursive: true });
    }
  });
});

function requestFor(requests: JsonRpcRequest[], method: string) {
  return requests.find((request) => request.method === method);
}

async function startSharedSocketServer(
  socketPath: string,
  responseForRequest: (request: JsonRpcRequest) => unknown,
) {
  await mkdir(dirname(socketPath), { recursive: true });
  const connections: WebSocket[] = [];
  const requests: JsonRpcRequest[] = [];
  const server = createServer();
  const webSocketServer = new WebSocketServer({ server });
  webSocketServer.on("connection", (socket) => {
    connections.push(socket);
    socket.on("message", (data) => {
      const request = JSON.parse(String(data)) as JsonRpcRequest;
      requests.push(request);
      if (typeof request.id !== "number") {
        return;
      }
      socket.send(JSON.stringify({ id: request.id, result: responseForRequest(request) }));
    });
  });
  await listen(server, socketPath);

  return {
    requests,
    async close() {
      for (const socket of connections) {
        socket.terminate();
      }
      await new Promise<void>((resolve, reject) => {
        webSocketServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          server.close((serverError) => (serverError ? reject(serverError) : resolve()));
        });
      });
    },
  };
}

function listen(server: Server, socketPath: string) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
}
