import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonData, PackageJsonResult } from "../core/types.js";

export async function readPackageJson(root: string): Promise<PackageJsonResult> {
  const file = path.join(root, "package.json");

  try {
    const raw = await readFile(file, "utf8");
    try {
      const content = JSON.parse(raw) as PackageJsonData;
      return { exists: true, content, parseError: null };
    } catch {
      return { exists: true, content: null, parseError: "The package.json file contains invalid JSON." };
    }
  } catch {
    return { exists: false, content: null, parseError: null };
  }
}