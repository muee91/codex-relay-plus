import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCodexRelayServerUrlState,
  fallbackCodexRelayServerUrl,
  getCodexRelayServerUrl,
  getCodexRelayServerUrlCandidates,
  saveCodexRelayServerUrlCandidates,
  setCodexRelayServerUrl,
} from "../../../apps/mobile/src/lib/codex-relay-server-url-storage.js";
import { requestWithNetworkTimeout } from "../../../apps/mobile/src/lib/network-timeout.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearCodexRelayServerUrlState();
});

describe("mobile Codex Relay API session storage", () => {
  it("clears the selected server URL and stored candidates", () => {
    setCodexRelayServerUrl("http://100.103.76.81:8787");
    saveCodexRelayServerUrlCandidates([
      "http://100.103.76.81:8787",
      "http://gronxb-macmini.taild999d7.ts.net:8787",
    ]);

    clearCodexRelayServerUrlState();

    expect(getCodexRelayServerUrl()).toBe(fallbackCodexRelayServerUrl);
    expect(getCodexRelayServerUrlCandidates()).toEqual([
      {
        label: "Localhost",
        url: fallbackCodexRelayServerUrl,
      },
    ]);
  });

  it("filters legacy Tailscale fallback candidates once Tailcat is paired", () => {
    setCodexRelayServerUrl("http://192.168.1.20:8787");
    saveCodexRelayServerUrlCandidates([
      "http://192.168.1.20:8787",
      "http://100.103.76.81:8787",
      "http://relay.example.ts.net:8787",
      "http://tailcat.invalid/?addr=tc-server-address&port=8787&v=1",
    ]);

    expect(getCodexRelayServerUrlCandidates()).toEqual([
      {
        label: "LAN IP",
        url: "http://192.168.1.20:8787",
      },
    ]);
  });

  it("keeps legacy remote candidates when no Tailcat bootstrap exists", () => {
    setCodexRelayServerUrl("http://192.168.1.20:8787");
    saveCodexRelayServerUrlCandidates([
      "http://192.168.1.20:8787",
      "http://100.103.76.81:8787",
    ]);

    expect(getCodexRelayServerUrlCandidates()).toEqual([
      {
        label: "LAN IP",
        url: "http://192.168.1.20:8787",
      },
      {
        label: "Legacy Tailscale IP",
        url: "http://100.103.76.81:8787",
      },
    ]);
  });

  it("rejects bootstrap requests when the network hangs", async () => {
    vi.useFakeTimers();

    const request = requestWithNetworkTimeout(
      new Promise<Response>(() => undefined),
      undefined,
      25,
    );
    const caught = request.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(25);

    await expect(caught).resolves.toMatchObject({ message: "Request timed out." });
  });
});
