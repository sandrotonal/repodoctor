import { stat } from "node:fs/promises";
import path from "node:path";
import type { PackageManagerDetection, ProjectFacts } from "../core/types.js";

const ENV_FILENAMES = [".env", ".env.local", ".env.production", ".env.development", ".env.test"] as const;

export async function directoryExists(root: string): Promise<boolean> {
  try {
    return (await stat(root)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(root: string, name: string, directory = false): Promise<boolean> {
  try {
    const entry = await stat(path.join(root, name));
    return directory ? entry.isDirectory() : entry.isFile();
  } catch {
    return false;
  }
}

export async function detectProjectFiles(root: string): Promise<ProjectFacts> {
  const [packageJsonExists, gitRepo, nodeModulesInstalled, envExampleExists, envFiles] = await Promise.all([
    fileExists(root, "package.json"),
    fileExists(root, ".git", true),
    fileExists(root, "node_modules", true),
    fileExists(root, ".env.example"),
    Promise.all(ENV_FILENAMES.map((name) => fileExists(root, name).then((found) => (found ? name : null)))),
  ]);

  const presentEnvFiles = envFiles.filter((name) => name !== null) as string[];
  const projectDetected = packageJsonExists || gitRepo || envExampleExists || presentEnvFiles.length > 0;

  return {
    projectDetected,
    packageJsonExists,
    gitRepo,
    nodeModulesInstalled,
    envFileExists: presentEnvFiles.length > 0,
    envExampleExists,
    envFiles: presentEnvFiles,
  };
}