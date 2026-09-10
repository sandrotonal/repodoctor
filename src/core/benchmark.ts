import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import type { SkippedReasons } from "./types.js";
import { scanProject, type ScanOptions } from "./scanner.js";

export interface BenchmarkOptions extends ScanOptions {
  warmup?: boolean;
}

export interface BenchmarkResult {
  targetDir: string;
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  bytesScanned: number;
  durationMs: number;
  peakMemoryMb: number;
  memoryDeltaMb: number;
  scanLimitReached: boolean;
  skippedReasons: SkippedReasons;
  throughputFilesPerSec: number;
  throughputMbPerSec: number;
}

/**
 * Runs a performance benchmark on a target repository or directory.
 * Measures throughput, memory usage, and file categorization.
 */
export async function runBenchmark(
  targetDir: string,
  options: BenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const absoluteTarget = resolve(targetDir);

  if (options.warmup) {
    try {
      await scanProject(absoluteTarget, { maxFiles: 100 });
    } catch {
      // Ignore warmup errors
    }
  }

  // Force garbage collection if exposed (--expose-gc)
  if (typeof global.gc === "function") {
    global.gc();
  }

  const initialMemoryRss = process.memoryUsage().rss;
  const startTime = performance.now();

  const scanResult = await scanProject(absoluteTarget, {
    maxFiles: options.maxFiles,
    maxFileSize: options.maxFileSize,
    ignoreFile: options.ignoreFile,
  });

  const durationMs = Math.max(1, Math.round(performance.now() - startTime));
  const finalMemoryRss = process.memoryUsage().rss;

  const filesDiscovered = scanResult.coverage?.filesDiscovered ?? 0;
  const filesScanned = scanResult.coverage?.filesScanned ?? 0;
  const filesSkipped = scanResult.coverage?.filesSkipped ?? 0;
  const bytesScanned = scanResult.coverage?.bytesScanned ?? 0;
  const scanLimitReached = scanResult.coverage?.scanLimitReached ?? false;

  const defaultReasons: SkippedReasons = {
    ignored: 0,
    binary: 0,
    tooLarge: 0,
    permissionDenied: 0,
    unsupportedExtension: 0,
    scanLimit: 0,
  };
  const skippedReasons = scanResult.coverage?.skippedReasons ?? defaultReasons;

  const peakMemoryMb =
    scanResult.coverage?.peakMemoryMb ??
    Math.round((finalMemoryRss / (1024 * 1024)) * 10) / 10;
  const memoryDeltaMb =
    Math.round(((finalMemoryRss - initialMemoryRss) / (1024 * 1024)) * 10) / 10;

  const seconds = durationMs / 1000;
  const throughputFilesPerSec = Math.round(filesScanned / seconds);
  const throughputMbPerSec =
    Math.round((bytesScanned / (1024 * 1024) / seconds) * 100) / 100;

  return {
    targetDir: absoluteTarget,
    filesDiscovered,
    filesScanned,
    filesSkipped,
    bytesScanned,
    durationMs,
    peakMemoryMb,
    memoryDeltaMb,
    scanLimitReached,
    skippedReasons,
    throughputFilesPerSec,
    throughputMbPerSec,
  };
}
