import { describe, expect, it } from "vitest";

import { renderControlCenterPage } from "../src/control-center-page.js";

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
});
