import { describe, expect, it, vi } from "vitest";

import {
  parseTailscaleServePreviewUrl,
  startTailscaleServeForPreviewUrl,
  type ExecFileRunner,
} from "../src/tailscale-serve.js";

describe("parseTailscaleServePreviewUrl", () => {
  it("keeps legacy Tailscale URLs parseable for deterministic upgrade errors", () => {
    expect(parseTailscaleServePreviewUrl("http://100.103.76.81:3000/")).toEqual({
      port: 3000,
      sourceUrl: "http://100.103.76.81:3000/",
    });
  });

  it("rejects ordinary LAN preview URLs instead of treating them as Tailscale", () => {
    expect(() => parseTailscaleServePreviewUrl("http://192.168.1.4:3000")).toThrow(
      "Preview URL host must be a legacy Tailscale address.",
    );
  });

  it("rejects a preview URL without an explicit port", () => {
    expect(() => parseTailscaleServePreviewUrl("http://100.103.76.81/")).toThrow(
      "Preview URL must include an explicit port.",
    );
  });
});

describe("startTailscaleServeForPreviewUrl", () => {
  it("never executes the Tailscale CLI and returns an upgrade error", async () => {
    const execFile = vi.fn<ExecFileRunner>();

    await expect(
      startTailscaleServeForPreviewUrl({
        execFile,
        url: "http://100.103.76.81:3000/",
      }),
    ).rejects.toThrow(
      "Tailscale Serve is no longer supported. Update the mobile app to use the built-in Tailcat transport.",
    );

    expect(execFile).not.toHaveBeenCalled();
  });
});
