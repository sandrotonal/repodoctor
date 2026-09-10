import { describe, expect, it } from "vitest";
import { checkSecurity } from "../src/checks/security.js";
import { calculateShannonEntropy, evaluateConfidence, maskSecret, scanSecrets } from "../src/detectors/secrets.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Phase 1: Secret Scanner Hardening & Zero-Leakage Guarantee", () => {
  it("calculates Shannon entropy correctly", () => {
    const lowEntropy = calculateShannonEntropy("AAAAAAAAAAAAAA");
    expect(lowEntropy).toBe(0);

    const repetitive = calculateShannonEntropy("ABABABABABABAB");
    expect(repetitive).toBeLessThan(1.5);

    const highEntropy = calculateShannonEntropy("sk-proj-7aF89bCx90LmNpQrStUvWxYz1234567890");
    expect(highEntropy).toBeGreaterThan(3.5);
  });

  it("suppresses known dummy and documentation credentials", () => {
    const awsDummy = evaluateConfidence("secret.aws-key", "AKIAIOSFODNN7EXAMPLE", "src/config.ts");
    expect(awsDummy.suppressed).toBe(true);
    expect(awsDummy.confidence).toBe("suppressed");

    const stripeDummy = evaluateConfidence("secret.stripe-key", "sk_test_51Abcdefghijklmnopqrstuvwxyz", "src/billing.ts");
    expect(stripeDummy.suppressed).toBe(true);
    expect(stripeDummy.confidence).toBe("suppressed");

    const placeholder = evaluateConfidence("secret.openai-key", "sk-your-key-here-placeholder-12345", "src/ai.ts");
    expect(placeholder.suppressed).toBe(true);
  });

  it("assigns medium confidence for credentials in example and doc paths", () => {
    const docSecret = evaluateConfidence("secret.openai-key", "sk-proj-9876543210abcdefghijklmnop", "examples/quickstart.ts");
    expect(docSecret.suppressed).toBe(false);
    expect(docSecret.confidence).toBe("medium");
  });

  it("assigns high confidence for valid high-entropy credentials in application code", () => {
    const realSecret = evaluateConfidence("secret.openai-key", "sk-proj-9876543210abcdefghijklmnop", "src/services/ai.ts");
    expect(realSecret.suppressed).toBe(false);
    expect(realSecret.confidence).toBe("high");
  });

  it("never leaks raw secret in diagnostics or maskedMatch", async () => {
    const rawSecret = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";
    const fixture = await makeFixture({
      "src/secret.ts": `const apiKey = "${rawSecret}";\n`,
    });

    try {
      const scan = await scanSecrets(fixture, null);
      const diagnostics = checkSecurity(scan);

      expect(diagnostics.length).toBeGreaterThan(0);
      const stringified = JSON.stringify(diagnostics);

      // Raw secret must NEVER be present anywhere in diagnostics
      expect(stringified).not.toContain(rawSecret);
      expect(diagnostics.some((d) => d.message?.includes(maskSecret(rawSecret)))).toBe(true);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("does not report critical severity for suppressed dummy AWS keys in project scan", async () => {
    const fixture = await makeFixture({
      "src/aws.ts": 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";\n',
    });

    try {
      const scan = await scanSecrets(fixture, null);
      const diagnostics = checkSecurity(scan);

      const criticalFindings = diagnostics.filter((d) => d.severity === "critical");
      expect(criticalFindings.length).toBe(0);

      const suppressedFinding = diagnostics.find((d) => d.suppressed === true);
      expect(suppressedFinding).toBeDefined();
      expect(suppressedFinding?.severity).toBe("info");
    } finally {
      await removeFixture(fixture);
    }
  });
});
