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

  it("keeps the normal desktop dashboard within one viewport", () => {
    const html = renderControlCenterPage("test-token");

    expect(html).toContain("html, body { width: 100%; height: 100%; overflow: hidden; }");
    expect(html).toContain("height: 100vh;");
    expect(html).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto;");
    expect(html).toContain('class="section session-section"');
    expect(html).toContain("bottom: 48px;");
    expect(html).toContain("max-height: calc(100% - 66px);");
  });

  it("keeps the Tailcat toggle in the menu bar instead of a top window strip", () => {
    expect(desktopSource).toContain('title: "Tailcat 远程访问"');
    expect(desktopSource).not.toContain("NSSwitch()");
    expect(desktopSource).not.toContain("tailcatBar");
    expect(desktopSource).toContain("nextWebView.topAnchor.constraint(equalTo: content.topAnchor)");
  });
});
