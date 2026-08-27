import { describe, expect, it } from "vitest";
import { detectConfigs } from "../src/detectors/configs.js";
import { checkConfigs } from "../src/checks/configs.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Configs & Tooling Detector", () => {
  it("detects TypeScript configuration and strict mode", async () => {
    const fixture = await makeFixture({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
        },
      }),
      "src/index.ts": "export const x = 1;",
    });

    try {
      const state = await detectConfigs(fixture);
      expect(state.typescript.exists).toBe(true);
      expect(state.typescript.valid).toBe(true);
      expect(state.typescript.strict).toBe(true);

      const diagnostics = checkConfigs(state);
      expect(diagnostics.some((d) => d.id === "typescript.strict-enabled")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("warns when TS files exist without tsconfig.json", async () => {
    const fixture = await makeFixture({
      "src/index.ts": "export const x = 1;",
    });

    try {
      const state = await detectConfigs(fixture);
      expect(state.typescript.hasTsFiles).toBe(true);
      expect(state.typescript.exists).toBe(false);

      const diagnostics = checkConfigs(state);
      expect(diagnostics.some((d) => d.id === "typescript.missing-config")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects Dockerfile and missing .dockerignore", async () => {
    const fixture = await makeFixture({
      Dockerfile: "FROM node:18\nCOPY . .\nCMD ['node', 'index.js']",
    });

    try {
      const state = await detectConfigs(fixture);
      expect(state.docker.hasDockerfile).toBe(true);
      expect(state.docker.hasDockerignore).toBe(false);

      const diagnostics = checkConfigs(state);
      expect(diagnostics.some((d) => d.id === "docker.missing-dockerignore")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("validates complete .dockerignore", async () => {
    const fixture = await makeFixture({
      Dockerfile: "FROM node:18\n",
      ".dockerignore": "node_modules\n.env\n.git\n",
    });

    try {
      const state = await detectConfigs(fixture);
      expect(state.docker.hasDockerignore).toBe(true);
      expect(state.docker.ignoresNodeModules).toBe(true);
      expect(state.docker.ignoresEnv).toBe(true);
      expect(state.docker.ignoresGit).toBe(true);

      const diagnostics = checkConfigs(state);
      expect(diagnostics.some((d) => d.id === "docker.dockerignore-valid")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects exposed private key files", async () => {
    const fixture = await makeFixture({
      id_rsa: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
      "server.key": "keycontent",
    });

    try {
      const state = await detectConfigs(fixture);
      expect(state.exposedFiles.length).toBe(2);

      const diagnostics = checkConfigs(state);
      expect(diagnostics.some((d) => d.id.includes("exposed-file:id_rsa"))).toBe(true);
      expect(diagnostics.some((d) => d.id.includes("exposed-file:server.key"))).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });
});
