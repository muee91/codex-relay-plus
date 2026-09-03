import { describe, expect, it } from "vitest";

import { renderControlCenterPage } from "../src/control-center-page.js";

describe("renderControlCenterPage", () => {
  it("renders bilingual pairing and device controls", () => {
    const html = renderControlCenterPage("local-token");

    expect(html).toContain("Codex Relay Plus");
    expect(html).toContain("简体中文");
    expect(html).toContain("English");
    expect(html).toContain("待确认设备");
    expect(html).toContain("Paired devices");
  });

  it("escapes the embedded local control token", () => {
    const html = renderControlCenterPage("a\"b<c");

    expect(html).toContain("content=\"a&quot;b&lt;c\"");
    expect(html).not.toContain("content=\"a\\\"b<c\"");
  });
});
