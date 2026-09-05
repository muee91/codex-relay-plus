import { afterEach, describe, expect, it } from "vitest";

import {
  createPairingQrPayload,
  getConnectUrlGuidance,
  getTailcatSnapshot,
  normalizeUrl,
} from "../src/pairing-url-candidates.js";

const tailcatEnvKeys = [
  "CODEX_RELAY_TAILCAT_ADDR",
  "CODEX_RELAY_TAILCAT_ENABLED",
  "CODEX_RELAY_TAILCAT_PORT",
  "CODEX_RELAY_TAILCAT_STATUS_FILE",
] as const;
const originalTailcatEnv = Object.fromEntries(
  tailcatEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof tailcatEnvKeys)[number], string | undefined>;

afterEach(() => {
  for (const key of tailcatEnvKeys) {
    const value = originalTailcatEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("pairing URL candidates", () => {
  it("keeps the primary serverUrl while adding compact candidate hosts for newer apps", () => {
    const payload = createPairingQrPayload({
      serverPublicKey: "server-public-key",
      serverUrls: ["http://100.64.0.10:8787", "http://192.168.1.10:8787"],
    });

    const parsed = new URL(payload);
    expect(parsed.protocol).toBe("codex-relay:");
    expect(parsed.hostname).toBe("pair");
    expect(parsed.searchParams.get("serverUrl")).toBe("http://100.64.0.10:8787");
    expect(parsed.searchParams.get("serverPublicKey")).toBe("server-public-key");
    expect(parsed.searchParams.get("h")).toBe("192.168.1.10");
    expect(parsed.searchParams.has("serverUrls")).toBe(false);
  });

  it("omits compact candidates when there is only one URL", () => {
    const payload = createPairingQrPayload({
      serverPublicKey: "server-public-key",
      serverUrls: ["http://192.168.1.10:8787"],
    });

    const parsed = new URL(payload);
    expect(parsed.searchParams.get("serverUrl")).toBe("http://192.168.1.10:8787");
    expect(parsed.searchParams.has("h")).toBe(false);
  });

  it("does not compact candidates with a different protocol or port", () => {
    const payload = createPairingQrPayload({
      serverPublicKey: "server-public-key",
      serverUrls: [
        "http://100.64.0.10:8787",
        "https://relay.example.com",
        "http://192.168.1.10:8788",
      ],
    });

    const parsed = new URL(payload);
    expect(parsed.searchParams.has("h")).toBe(false);
    expect(parsed.searchParams.has("serverUrls")).toBe(false);
  });

  it("normalizes only http and https URLs", () => {
    expect(normalizeUrl(" http://192.168.1.10:8787/ ")).toBe("http://192.168.1.10:8787");
    expect(normalizeUrl("https://relay.example.com/")).toBe("https://relay.example.com");
    expect(normalizeUrl("ftp://relay.example.com")).toBeUndefined();
    expect(normalizeUrl("")).toBeUndefined();
  });

  it("explains private addresses as LAN paths with Tailcat fallback", () => {
    expect(getConnectUrlGuidance("http://192.168.1.10:8787")).toContain("Tailcat");
    expect(getConnectUrlGuidance("http://10.0.0.10:8787")).toContain("Tailcat");
  });

  it("identifies old Tailscale addresses as legacy migration inputs", () => {
    expect(getConnectUrlGuidance("http://100.103.76.81:8787")).toContain("legacy Tailscale");
    expect(getConnectUrlGuidance("http://relay.tailnet.ts.net:8787")).toContain("Tailcat");
  });

  it("warns when the mobile URL is only reachable locally", () => {
    expect(getConnectUrlGuidance("http://127.0.0.1:8787")).toContain("only reachable");
    expect(getConnectUrlGuidance("http://0.0.0.0:8787")).toContain("only reachable");
  });

  it("reports an explicitly disabled Tailcat transport and omits it from pairing", () => {
    process.env.CODEX_RELAY_TAILCAT_ENABLED = "0";
    process.env.CODEX_RELAY_TAILCAT_ADDR = "tcDisabledExample";
    process.env.CODEX_RELAY_TAILCAT_PORT = "8787";

    expect(getTailcatSnapshot()).toMatchObject({
      configured: true,
      enabled: false,
      ready: false,
    });

    const payload = new URL(
      createPairingQrPayload({
        serverPublicKey: "server-public-key",
        serverUrls: ["http://192.168.1.10:8787"],
      }),
    );
    expect(payload.searchParams.has("tailcatAddr")).toBe(false);
    expect(payload.searchParams.has("tailcatPort")).toBe(false);
  });

  it("reports enabled Tailcat as ready when a valid direct node is available", () => {
    process.env.CODEX_RELAY_TAILCAT_ENABLED = "1";
    process.env.CODEX_RELAY_TAILCAT_ADDR = "tcReadyExample";
    process.env.CODEX_RELAY_TAILCAT_PORT = "8787";

    expect(getTailcatSnapshot()).toMatchObject({
      address: "tcReadyExample",
      configured: true,
      enabled: true,
      port: 8787,
      ready: true,
    });
  });

  it("distinguishes enabled-but-starting Tailcat from an unavailable host integration", () => {
    process.env.CODEX_RELAY_TAILCAT_ENABLED = "1";
    delete process.env.CODEX_RELAY_TAILCAT_ADDR;
    delete process.env.CODEX_RELAY_TAILCAT_PORT;
    delete process.env.CODEX_RELAY_TAILCAT_STATUS_FILE;

    expect(getTailcatSnapshot()).toMatchObject({
      configured: true,
      enabled: true,
      ready: false,
    });
  });
});
