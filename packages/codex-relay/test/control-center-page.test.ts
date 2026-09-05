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

  it("labels diagnostic copy actions by the data they copy", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain("复制 Relay 地址");
    expect(html).toContain("Tailcat 节点");
    expect(html).not.toContain('data-i18n="copyMobile"');
  });

  it("uses a compact two-column desktop dashboard instead of the old hero and fact grid", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain('class="dashboard"');
    expect(html).toContain('class="card overview-card"');
    expect(html).toContain('class="card devices-card"');
    expect(html).toContain('class="card pair-card"');
    expect(html).toContain("grid-template-columns: minmax(0, 1fr) 332px;");
    expect(html).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain('class="facts"');
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

  it("keeps the Tailcat toggle in the menu bar instead of the dashboard", () => {
    const html = renderControlCenterPage("test-token");

    expect(desktopSource).toContain('title: "Tailcat 远程访问"');
    expect(desktopSource).not.toContain("NSSwitch()");
    expect(desktopSource).not.toContain("tailcatBar");
    expect(desktopSource).toContain("nextWebView.topAnchor.constraint(equalTo: content.topAnchor)");
    expect(html).not.toContain('type="checkbox"');
  });
});
