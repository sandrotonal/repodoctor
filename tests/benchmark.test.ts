import { describe, expect, it } from "vitest";
import { runBenchmark } from "../src/core/benchmark.js";
import { makeFixture, removeFixture } from "./helpers/fixtures.js";

describe("Benchmark Engine", () => {
  it("runs benchmark and returns throughput, memory, and skip metrics", async () => {
    // Generate synthetic directory with files of various types
    const files: Record<string, string> = {
      "package.json": JSON.stringify({ name: "benchmark-test", version: "1.0.0" }),
      "README.md": "# Benchmark Test\n".repeat(10),
      "src/index.ts": "export const a = 1;\n",
      "src/utils.ts": "export function sum(a: number, b: number) { return a + b; }\n",
      "src/utils.test.ts": "test('sum', () => {});\n", // should be ignored
      "assets/logo.png": "fake binary data", // binary extension
      "notes.unknownext": "unsupported extension content", // unsupported extension
    };

    // Add 50 synthetic source files
    for (let i = 0; i < 50; i++) {
      files[`src/generated/file_${i}.ts`] = `export const item_${i} = ${i};\n`;
    }

    const fixture = await makeFixture(files);

    try {
      const result = await runBenchmark(fixture, { warmup: false });

      expect(result.targetDir).toBeDefined();
      expect(result.filesDiscovered).toBeGreaterThanOrEqual(55);
      expect(result.filesScanned).toBeGreaterThanOrEqual(52);
      expect(result.bytesScanned).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.throughputFilesPerSec).toBeGreaterThan(0);
      expect(result.peakMemoryMb).toBeGreaterThan(0);
      expect(result.skippedReasons).toBeDefined();
      expect(result.skippedReasons.ignored).toBeGreaterThanOrEqual(1); // test file
      expect(result.skippedReasons.binary).toBeGreaterThanOrEqual(1); // png
      expect(result.skippedReasons.unsupportedExtension).toBeGreaterThanOrEqual(1); // unknownext
      expect(result.scanLimitReached).toBe(false);
    } finally {
      await removeFixture(fixture);
    }
  });

  it("respects maxFiles limit in benchmark and flags scanLimitReached", async () => {
    const files: Record<string, string> = {
      "package.json": "{}",
    };
    for (let i = 0; i < 30; i++) {
      files[`file_${i}.ts`] = `export const x_${i} = ${i};`;
    }

    const fixture = await makeFixture(files);

    try {
      const result = await runBenchmark(fixture, { maxFiles: 10 });
      expect(result.filesScanned).toBeLessThanOrEqual(10);
      expect(result.scanLimitReached).toBe(true);
      expect(result.skippedReasons.scanLimit).toBeGreaterThan(0);
    } finally {
      await removeFixture(fixture);
    }
  });
});
