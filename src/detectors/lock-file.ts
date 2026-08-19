import { readFile } from "node:fs/promises";
import path from "node:path";

export interface NpmLockInfo {
  lockfileVersion: number | null;
  rootDependencies: Record<string, string>;
  installedNames: Set<string>;
}

export interface NpmLockResult {
  exists: boolean;
  parseError: string | null;
  content: NpmLockInfo | null;
}

interface NpmLockJson {
  lockfileVersion?: number;
  packages?: Record<string, { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
  dependencies?: Record<string, { version?: string }>;
}

export async function readNpmLock(root: string): Promise<NpmLockResult> {
  const file = path.join(root, "package-lock.json");

  try {
    const raw = await readFile(file, "utf8");
    try {
      const json = JSON.parse(raw) as NpmLockJson;
      const installedNames = new Set<string>();

      if (json.packages) {
        for (const key of Object.keys(json.packages)) {
          const segments = key.split("node_modules/");
          const name = segments[segments.length - 1];
          if (name.length > 0) {
            installedNames.add(name);
          }
        }
      }

      if (json.dependencies) {
        for (const name of Object.keys(json.dependencies)) {
          installedNames.add(name);
        }
      }

      const rootPackage = json.packages?.[""];
      return {
        exists: true,
        parseError: null,
        content: {
          lockfileVersion: json.lockfileVersion ?? null,
          rootDependencies: {
            ...(rootPackage?.dependencies ?? {}),
            ...(rootPackage?.devDependencies ?? {}),
          },
          installedNames,
        },
      };
    } catch {
      return { exists: true, parseError: "The package-lock.json file contains invalid JSON.", content: null };
    }
  } catch {
    return { exists: false, parseError: null, content: null };
  }
}