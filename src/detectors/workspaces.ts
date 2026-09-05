import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonData } from "../core/types.js";

export interface WorkspacePackage {
  name: string;
  relativeDir: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface VersionDrift {
  packageName: string;
  versions: Array<{ workspaceName: string; version: string }>;
}

export interface WorkspaceScanResult {
  isMonorepo: boolean;
  tool: "pnpm" | "turborepo" | "npm/yarn" | "lerna" | null;
  packages: WorkspacePackage[];
  versionDrifts: VersionDrift[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function detectWorkspaces(
  root: string,
  rootPkg: PackageJsonData | null,
): Promise<WorkspaceScanResult> {
  const [hasPnpmWorkspace, hasTurbo, hasLerna] = await Promise.all([
    fileExists(path.join(root, "pnpm-workspace.yaml")),
    fileExists(path.join(root, "turbo.json")),
    fileExists(path.join(root, "lerna.json")),
  ]);

  const hasNpmWorkspaces = Boolean(
    rootPkg && (Array.isArray(rootPkg.workspaces) || (rootPkg.workspaces && typeof rootPkg.workspaces === "object")),
  );

  const isMonorepo = hasPnpmWorkspace || hasTurbo || hasLerna || hasNpmWorkspaces;

  if (!isMonorepo) {
    return {
      isMonorepo: false,
      tool: null,
      packages: [],
      versionDrifts: [],
    };
  }

  let tool: "pnpm" | "turborepo" | "npm/yarn" | "lerna" = "npm/yarn";
  if (hasPnpmWorkspace) tool = "pnpm";
  else if (hasTurbo) tool = "turborepo";
  else if (hasLerna) tool = "lerna";

  // Common workspace folders to inspect: packages/*, apps/*, libs/*
  const searchDirs = ["packages", "apps", "libs", "modules"];
  const packages: WorkspacePackage[] = [];

  for (const subDir of searchDirs) {
    const fullDir = path.join(root, subDir);
    if (!(await dirExists(fullDir))) continue;

    let entries: string[] = [];
    try {
      entries = await readdir(fullDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const pkgJsonPath = path.join(fullDir, entry, "package.json");
      if (await fileExists(pkgJsonPath)) {
        try {
          const raw = await readFile(pkgJsonPath, "utf8");
          const parsed = JSON.parse(raw) as PackageJsonData;
          packages.push({
            name: parsed.name || `${subDir}/${entry}`,
            relativeDir: `${subDir}/${entry}`,
            dependencies: (parsed.dependencies as Record<string, string>) || {},
            devDependencies: (parsed.devDependencies as Record<string, string>) || {},
          });
        } catch {
          // ignore corrupted sub-package
        }
      }
    }
  }

  // Find version drifts across packages
  const depVersionsMap = new Map<string, Map<string, string>>(); // depName -> (version -> workspaceName)

  for (const pkg of packages) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [depName, version] of Object.entries(allDeps)) {
      if (version.startsWith("workspace:")) continue;
      let map = depVersionsMap.get(depName);
      if (!map) {
        map = new Map();
        depVersionsMap.set(depName, map);
      }
      map.set(pkg.name, version);
    }
  }

  const versionDrifts: VersionDrift[] = [];
  for (const [depName, pkgVersionMap] of depVersionsMap.entries()) {
    const uniqueVersions = new Set(pkgVersionMap.values());
    if (uniqueVersions.size > 1) {
      versionDrifts.push({
        packageName: depName,
        versions: Array.from(pkgVersionMap.entries()).map(([workspaceName, version]) => ({
          workspaceName,
          version,
        })),
      });
    }
  }

  return {
    isMonorepo: true,
    tool,
    packages,
    versionDrifts,
  };
}
