import { describe, it, expect } from "vitest";
import { checkNodeVersion } from "../src/checks/node-version.js";

describe("checkNodeVersion", () => {
  it("always reports the current Node.js runtime", () => {
    const diagnostics = checkNodeVersion("v22.11.0", null);
    expect(diagnostics.some((d) => d.id === "node.runtime" && d.title.includes("v22.11.0"))).toBe(true);
  });

  it("reports compatible when the current version satisfies engines", () => {
    const diagnostics = checkNodeVersion("v22.11.0", { engines: { node: ">=20" } });
    expect(diagnostics.some((d) => d.id === "node-version.compatible" && d.severity === "success")).toBe(true);
    expect(diagnostics.some((d) => d.id === "node-version.mismatch")).toBe(false);
  });

  it("reports a mismatch when the current version violates engines", () => {
    const diagnostics = checkNodeVersion("v18.20.0", { engines: { node: ">=20" } });
    const mismatch = diagnostics.find((d) => d.id === "node-version.mismatch");
    expect(mismatch?.severity).toBe("critical");
    expect(mismatch?.message).toContain(">=20");
    expect(mismatch?.message).toContain("v18.20.0");
    expect(diagnostics.some((d) => d.id === "node-version.compatible")).toBe(false);
  });

  it("accepts a v-prefixed engines range", () => {
    const diagnostics = checkNodeVersion("v20.10.0", { engines: { node: ">=18" } });
    expect(diagnostics.some((d) => d.id === "node-version.compatible")).toBe(true);
  });

  it("reports a warning for an invalid range", () => {
    const diagnostics = checkNodeVersion("v22.11.0", { engines: { node: "not-a-range" } });
    expect(diagnostics.some((d) => d.id === "node-version.invalid-range" && d.severity === "warning")).toBe(true);
  });

  it("reports only runtime info when engines.node is absent", () => {
    const diagnostics = checkNodeVersion("v22.11.0", { engines: {} });
    expect(diagnostics.some((d) => d.id === "node.runtime")).toBe(true);
    expect(diagnostics.some((d) => d.id === "node-version.mismatch")).toBe(false);
  });
});