import { resolve } from "node:path";
import type { Diagnostic, PackageJsonResult, PackageManagerDetection, ProjectFacts, ScanResult } from "./types.js";
import { detectPackageManager } from "../detectors/package-manager.js";
import { readPackageJson } from "../detectors/package-json.js";
import { detectProjectFiles, directoryExists } from "../detectors/project.js";
import { checkNodeProject } from "../checks/node.js";
import { checkNodeVersion } from "../checks/node-version.js";
import { checkPackageJson } from "../checks/package-json.js";

export async function scanProject(root: string): Promise<ScanResult> {
  const absoluteRoot = resolve(root);

  if (!(await directoryExists(absoluteRoot))) {
    return {
      root: absoluteRoot,
      projectDetected: false,
      packageJsonExists: false,
      gitRepo: false,
      nodeModulesInstalled: false,
      envFileExists: false,
      envExampleExists: false,
      envFiles: [],
      packageManager: { manager: null, lockFiles: [], ambiguous: false },
      packageJson: { exists: false, content: null, parseError: null },
      diagnostics: [
        {
          id: "project.directory-missing",
          severity: "critical",
          title: "Project directory not found",
          message: `Directory does not exist: ${absoluteRoot}`,
          recommendation: "Check the path and run RepoDoctor again.",
        },
      ],
    };
  }

  const [files, packageManager, packageJson] = await Promise.all([
    detectProjectFiles(absoluteRoot),
    detectPackageManager(absoluteRoot),
    readPackageJson(absoluteRoot),
  ]);

  const diagnostics = buildDiagnostics({ root: absoluteRoot, files, packageManager, packageJson });

  return {
    root: absoluteRoot,
    ...files,
    packageManager,
    packageJson,
    diagnostics,
  };
}

interface BuildContext {
  root: string;
  files: ProjectFacts;
  packageManager: PackageManagerDetection;
  packageJson: PackageJsonResult;
}

function buildDiagnostics(ctx: BuildContext): Diagnostic[] {
  const { root, files, packageManager, packageJson } = ctx;
  const diagnostics: Diagnostic[] = [
    {
      id: "project.directory",
      severity: "success",
      title: "Project directory detected",
      message: root,
    },
  ];

  if (!files.projectDetected) {
    diagnostics.push({
      id: "project.not-detected",
      severity: "warning",
      title: "No project detected",
      message: "No known project files were found in this directory.",
    });
    return diagnostics;
  }

  if (files.packageJsonExists) {
    diagnostics.push({ id: "project.package-json", severity: "success", title: "package.json detected" });
  }

  if (files.gitRepo) {
    diagnostics.push({ id: "project.git", severity: "success", title: "Git repository detected" });
  }

  if (packageManager.ambiguous) {
    diagnostics.push({
      id: "package-manager.ambiguous",
      severity: "warning",
      title: "Multiple package managers detected",
      message: `Found: ${packageManager.lockFiles.join(", ")}`,
      recommendation: "Keep only the lock file belonging to the package manager used by this project.",
    });
  } else if (packageManager.manager) {
    diagnostics.push({
      id: "project.package-manager",
      severity: "success",
      title: `${packageManager.manager} detected`,
      message: `Lock file: ${packageManager.lockFiles[0]}`,
    });
  }

  if (files.nodeModulesInstalled) {
    diagnostics.push({ id: "project.node-modules", severity: "success", title: "node_modules detected" });
  }

  if (files.envFileExists) {
    diagnostics.push({ id: "project.env", severity: "success", title: ".env detected" });
  }

  if (files.envExampleExists) {
    diagnostics.push({ id: "project.env-example", severity: "success", title: ".env.example detected" });
  }

  diagnostics.push(...checkNodeProject(files.packageJsonExists));
  diagnostics.push(...checkPackageJson(packageJson.content, packageJson.parseError, packageManager));
  diagnostics.push(...checkNodeVersion(process.version, packageJson.content));

  return diagnostics;
}