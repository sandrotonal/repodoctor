import type { ScanResult } from "../core/types.js";

export function formatJson(result: ScanResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function renderJson(result: ScanResult): void {
  process.stdout.write(formatJson(result));
}