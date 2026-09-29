import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { renderControlCenterPage } from "../src/control-center-page.js";

const desktopSource = readFileSync(
  new URL("../../../apps/desktop-macos/Sources/main.swift", import.meta.url),
  "utf8",
);

describe("control center page", () => {
  it("keeps the primary pairing fallback unambiguous", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain('id="copy-pair"');
    expect(html).toContain("复制配对链接");
    expect(html).toContain("Copy pairing link");
    expect(html).not.toContain('id="copy-mobile"');
    expect(html).not.toContain("复制配对信息");
  });

  it("renders Tailcat from structured host state instead of reparsing the pairing payload", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain("var tailcat = state.tailcat || {};");
    expect(html).toContain('id="tailcat-node"');
    expect(html).toContain('id="tailcat-port"');
    expect(html).not.toContain("getPairingParam");
  });

  it("keeps technical Tailcat identifiers out of the primary status summary", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain('id="remote-detail"');
    expect(html).toContain('byId("remote-detail").textContent = t("remoteReadyDetail");');
    expect(html).toContain("自动远程连接");
    expect(html).toContain("Tailcat 节点");
  });

  it("uses a balanced full-width summary above equal-height device and pairing work areas", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain('class="card summary-card"');
    expect(html).toContain('class="content-grid"');
    expect(html).toContain('class="card devices-card"');
    expect(html).toContain('class="card pair-card"');
    expect(html).toContain("grid-template-rows: 118px minmax(0, 1fr);");
    expect(html).toContain("grid-template-columns: minmax(0, 1fr) 360px;");
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain('class="facts"');
    expect(html).not.toContain('class="brand-mark"');
  });

  it("keeps the desktop dashboard inside one viewport and diagnostics out of document flow", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain("html, body { width: 100%; height: 100%; overflow: hidden; }");
    expect(html).toContain("height: 100vh;");
    expect(html).toContain('id="diagnostics-drawer"');
    expect(html).toContain("position: absolute;");
    expect(html).toContain("transform: translateX(102%);");
    expect(html).not.toContain("details.advanced");
  });

  it("keeps the Tailcat toggle in a compact menu without rendering the long node address", () => {
    const html = renderControlCenterPage("test-token");

    expect(desktopSource).toContain('title: "Tailcat 远程访问"');
    expect(desktopSource).toContain('title: "复制 Tailcat 节点"');
    expect(desktopSource).not.toContain("tailcatAddressMenuItem");
    expect(desktopSource).not.toContain('"Tailcat 节点：');
    expect(desktopSource).not.toContain("NSSwitch()");
    expect(desktopSource).toContain("width: 1040, height: 620");
    expect(desktopSource).toContain("width: 900, height: 580");
    expect(html).not.toContain('type="checkbox"');
  });
});
