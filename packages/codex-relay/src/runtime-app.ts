import { AsyncLocalStorage } from "node:async_hooks";
import { Hono } from "hono";

import { CodexAppServerClient } from "./app-server.js";
import { createApp as createBaseApp } from "./app.js";

type BaseAppOptions = NonNullable<Parameters<typeof createBaseApp>[0]>;

const archivedThreadListContext = new AsyncLocalStorage<boolean>();

export function createRuntimeApp(options: BaseAppOptions = {}) {
  const appServer = resolveAppServer(options.appServer);
  const baseApp = createBaseApp({
    ...options,
    appServer: appServer ? archivedAwareAppServer(appServer) : appServer,
  });
  const app = new Hono();

  app.get("/v1/threads/archived", async (c) => {
    if (!appServer) {
      return c.json({ threads: [], source: "memory" });
    }

    return archivedThreadListContext.run(true, () =>
      baseApp.fetch(rewriteRequest(c.req.raw, "/v1/threads", "GET")),
    );
  });

  app.post("/v1/threads/:threadId/unarchive", async (c) => {
    if (!appServer) {
      return c.json(
        apiError("unsupported", "Restoring archived threads requires the Codex app-server."),
        409,
      );
    }

    if (!(await hasValidPairingSession(c.req.header("authorization"), options.pairing))) {
      return c.json(apiError("unauthorized", "Pair this device with the Codex Relay server."), 401);
    }

    const threadId = c.req.param("threadId");
    try {
      await appServer.unarchiveThread({ threadId });
      return baseApp.fetch(rewriteRequest(c.req.raw, "/v1/threads", "GET"));
    } catch (error) {
      const message = errorMessage(error);
      const status = /not found|no rollout found/i.test(message) ? 404 : 502;
      return c.json(apiError(status === 404 ? "not_found" : "unarchive_unavailable", message), status);
    }
  });

  app.all("*", (c) => baseApp.fetch(c.req.raw));
  return app;
}

function resolveAppServer(appServer: BaseAppOptions["appServer"]) {
  if (appServer !== undefined) {
    return appServer;
  }
  return process.env.VITEST ? null : new CodexAppServerClient();
}

function archivedAwareAppServer(appServer: CodexAppServerClient) {
  return new Proxy(appServer, {
    get(target, property) {
      if (property === "listThreads") {
        return (...args: Parameters<CodexAppServerClient["listThreads"]>) =>
          archivedThreadListContext.getStore()
            ? target.listThreads(80, { archived: true })
            : target.listThreads(...args);
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function hasValidPairingSession(
  authorization: string | undefined,
  pairing: BaseAppOptions["pairing"],
) {
  if (!pairing) {
    return true;
  }

  const token = parseBearerToken(authorization);
  if (!token) {
    return false;
  }

  const session = await pairing.sessions.getValidSession(pairing.hashClientToken(token));
  if (!session) {
    return false;
  }
  return !pairing.serverIdentity || Boolean(session.secureSession);
}

function parseBearerToken(value: string | undefined) {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function rewriteRequest(request: Request, pathname: string, method: "GET") {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return new Request(url, {
    headers: request.headers,
    method,
  });
}

function apiError(code: string, message: string) {
  return { error: { code, message } };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Codex Relay request failed.";
}
