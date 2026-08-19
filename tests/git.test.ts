import { describe, it, expect } from "vitest";
import { checkGit } from "../src/checks/git.js";
import type { GitState } from "../src/detectors/git.js";

describe("checkGit", () => {
  it("returns no diagnostics when not a git repo", () => {
    expect(checkGit(null, false)).toEqual([]);
  });

  it("reports success and branch when the tree is clean", () => {
    const state: GitState = { isRepo: true, branch: "main", dirty: false, untracked: 0 };
    const diagnostics = checkGit(state, true);
    expect(diagnostics.find((d) => d.id === "git.state")?.severity).toBe("success");
    expect(diagnostics.find((d) => d.id === "git.state")?.message).toContain("main");
    expect(diagnostics.some((d) => d.id === "git.dirty")).toBe(false);
  });

  it("warns about uncommitted changes", () => {
    const state: GitState = { isRepo: true, branch: "feature/x", dirty: true, untracked: 3 };
    const diagnostics = checkGit(state, true);
    const dirty = diagnostics.find((d) => d.id === "git.dirty");
    expect(dirty?.severity).toBe("warning");
    expect(dirty?.message).toContain("3 untracked");
  });

  it("reports info when git state cannot be read", () => {
    const diagnostics = checkGit(null, true);
    expect(diagnostics.some((d) => d.id === "git.unavailable" && d.severity === "info")).toBe(true);
  });
});