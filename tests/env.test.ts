import { describe, it, expect } from "vitest";
import { checkEnv } from "../src/checks/env.js";
import { parseEnvKeys, readEnvState } from "../src/detectors/env.js";
import type { EnvState } from "../src/detectors/env.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("parseEnvKeys", () => {
  it("extracts keys from KEY=VALUE lines and ignores comments/blank lines", () => {
    const keys = parseEnvKeys("# comment\nPORT=3000\nAPI_KEY=abc\n\nSECRET=\"x y\"\n");
    expect(keys).toEqual(["PORT", "API_KEY", "SECRET"]);
  });

  it("ignores lines without an equals assignment", () => {
    const keys = parseEnvKeys("not-a-key\nPORT=3000");
    expect(keys).toEqual(["PORT"]);
  });
});

describe("readEnvState", () => {
  it("reads keys without exposing values", async () => {
    const root = await makeFixture({
      ".env": "DB_URL=secret-value\nTOKEN=hunter2\n",
      ".env.example": "DB_URL=\nTOKEN=\nOTHER=\n",
    });
    try {
      const state = await readEnvState(root);
      expect(state.envFileExists).toBe(true);
      expect(state.exampleExists).toBe(true);
      expect(state.envKeys).toEqual(["DB_URL", "TOKEN"]);
      expect(state.exampleKeys).toEqual(["DB_URL", "TOKEN", "OTHER"]);
      expect(state.envGitIgnored).toBe(false);
    } finally {
      await removeFixture(root);
    }
  });

  it("detects when .gitignore covers .env", async () => {
    const root = await makeFixture({ ".env": "PORT=3000\n", ".gitignore": "node_modules\n.env\n" });
    try {
      const state = await readEnvState(root);
      expect(state.envGitIgnored).toBe(true);
    } finally {
      await removeFixture(root);
    }
  });
});

describe("checkEnv", () => {
  const state: EnvState = {
    envFileExists: true,
    exampleExists: true,
    envKeys: ["PORT"],
    exampleKeys: ["PORT", "DATABASE_URL"],
    envGitIgnored: true,
  };

  it("warns when example keys are missing from .env", () => {
    const diagnostics = checkEnv(state);
    const missing = diagnostics.find((d) => d.id === "env.keys-missing");
    expect(missing?.severity).toBe("warning");
    expect(missing?.message).toContain("DATABASE_URL");
  });

  it("warns when .env is not gitignored", () => {
    const diagnostics = checkEnv({ ...state, envGitIgnored: false });
    expect(diagnostics.some((d) => d.id === "env.not-gitignored" && d.severity === "warning")).toBe(true);
  });

  it("warns when .env is missing but .env.example exists", () => {
    const diagnostics = checkEnv({ ...state, envFileExists: false });
    expect(diagnostics.some((d) => d.id === "env.missing" && d.severity === "warning")).toBe(true);
  });

  it("reports extra keys as info", () => {
    const diagnostics = checkEnv({ ...state, envKeys: ["PORT", "ADHOC"] });
    const extra = diagnostics.find((d) => d.id === "env.extra-keys");
    expect(extra?.severity).toBe("info");
    expect(extra?.message).toContain("ADHOC");
  });

  it("returns no diagnostics when no env files exist", () => {
    const diagnostics = checkEnv({ envFileExists: false, exampleExists: false, envKeys: [], exampleKeys: [], envGitIgnored: false });
    expect(diagnostics).toEqual([]);
  });
});