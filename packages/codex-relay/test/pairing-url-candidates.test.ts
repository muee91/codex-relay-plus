import { describe, expect, it } from "vitest";

import {
  createPairingQrPayload,
  getConnectUrlCandidates,
  getConnectUrlGuidance,
  isTailscaleStatusRunning,
  normalizeUrl,
  prioritizeConnectUrlCandidates,
  type ConnectUrlCandidate,
} from "../src/pairing-url-candidates.js";

function candidate(
  kind: ConnectUrlCandidate["kind"],
  label: string,
  url: string,
): ConnectUrlCandidate {
  return { kind, label, url };
}

describe("pairing URL candidates", () => {
  it("keeps the primary serverUrl while adding compact candidate hosts for newer apps", () => {
    const payload = createPairingQrPayload({
      serverPublicKey: "server-public-key",
      serverUrls: ["http://192.168.1.10:8787", "http://100.64.0.10:8787"],
    });

    const parsed = new URL(payload);
    expect(parsed.protocol).toBe("codex-relay:");
    expect(parsed.hostname).toBe("pair");
    expect(parsed.searchParams.get("serverUrl")).toBe("http://192.168.1.10:8787");
    expect(parsed.searchParams.get("serverPublicKey")).toBe("server-public-key");
    expect(parsed.searchParams.get("h")).toBe("100.64.0.10");
    expect(parsed.searchParams.has("serverUrls")).toBe(false);
  });

  it("prioritizes LAN before legacy Tailscale and public fallback addresses", () => {
    expect(
      prioritizeConnectUrlCandidates([
        candidate("tailscale", "Tailscale", "http://100.64.0.10:8787"),
        candidate("server", "Public", "https://relay.example.com"),
        candidate("lan", "Wi-Fi", "http://192.168.1.10:8787"),
        candidate("server", "Localhost", "http://127.0.0.1:8787"),
      ]).map((entry) => entry.url),
    ).toEqual([
      "http://192.168.1.10:8787",
      "http://100.64.0.10:8787",
      "https://relay.example.com",
      "http://127.0.0.1:8787",
    ]);
  });

  it("does not advertise Tailscale as the normal relay transport", () => {
    const candidates = getConnectUrlCandidates(
      { listenUrl: "http://0.0.0.0:8787", port: 8787 },
      {
        tailscale: {
          checkedAt: Date.now(),
          status: {
            BackendState: "Running",
            Self: {
              DNSName: "relay.example.ts.net.",
              Online: true,
              TailscaleIPs: ["100.64.0.10"],
            },
          },
        },
      },
    );

    expect(candidates.some((entry) => entry.kind === "tailscale")).toBe(false);
    expect(candidates.some((entry) => entry.url.includes("100.64.0.10"))).toBe(false);
    expect(candidates.some((entry) => entry.url.includes(".ts.net"))).toBe(false);
  });

  it("retains the legacy Tailscale status parser for compatibility", () => {
    expect(isTailscaleStatusRunning(undefined)).toBe(false);
    expect(isTailscaleStatusRunning({ BackendState: "Stopped" })).toBe(false);
    expect(isTailscaleStatusRunning({ BackendState: "Running", Self: { Online: false } })).toBe(
      false,
    );
    expect(isTailscaleStatusRunning({ BackendState: "Running", Self: { Online: true } })).toBe(
      true,
    );
    expect(isTailscaleStatusRunning({ BackendState: "Running", Self: {} })).toBe(true);
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

  it("preserves candidates with a different protocol or port as full URLs", () => {
    const payload = createPairingQrPayload({
      serverPublicKey: "server-public-key",
      serverUrls: [
        "http://192.168.1.10:8787",
        "https://relay.example.com",
        "http://100.64.0.10:8788",
      ],
    });

    const parsed = new URL(payload);
    expect(parsed.searchParams.has("h")).toBe(false);
    expect(JSON.parse(parsed.searchParams.get("serverUrls") ?? "[]")).toEqual([
      "https://relay.example.com",
      "http://100.64.0.10:8788",
    ]);
  });

  it("normalizes only http and https URLs", () => {
    expect(normalizeUrl(" http://192.168.1.10:8787/ ")).toBe("http://192.168.1.10:8787");
    expect(normalizeUrl("https://relay.example.com/")).toBe("https://relay.example.com");
    expect(normalizeUrl("ftp://relay.example.com")).toBeUndefined();
    expect(normalizeUrl("")).toBeUndefined();
  });

  it("explains local network addresses as same-Wi-Fi pairing", () => {
    expect(getConnectUrlGuidance("http://192.168.1.10:8787")).toContain("same network");
    expect(getConnectUrlGuidance("http://10.0.0.10:8787")).toContain("local Wi-Fi/LAN");
  });

  it("marks old Tailscale addresses as legacy Tailcat-replaced paths", () => {
    expect(getConnectUrlGuidance("http://100.103.76.81:8787")).toContain("Tailcat");
    expect(getConnectUrlGuidance("http://relay.tailnet.ts.net:8787")).toContain("legacy Tailscale");
  });

  it("warns when the mobile URL is only reachable locally", () => {
    expect(getConnectUrlGuidance("http://127.0.0.1:8787")).toContain("only reachable");
    expect(getConnectUrlGuidance("http://0.0.0.0:8787")).toContain("only reachable");
  });
});
