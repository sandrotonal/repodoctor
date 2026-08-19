import { resolve } from "node:path";
import type { Diagnostic, HealthScore, PackageJsonResult, PackageManagerDetection, ProjectFacts, ScanResult } from "./types.js";
import type { NpmLockResult } from "../detectors/lock-file.js";
import type { EnvState } from "../detectors/env.js";
import type { GitState } from "../detectors/git.js";
import type { PortSource } from "../detectors/ports.js";
import type { ImportScan } from "../detectors/imports.js";
import { detectPackageManager } from "../detectors/package-manager.js";
import { readPackageJson } from "../detectors/package-json.js";
import { detectProjectFiles, directoryExists } from "../detectors/project.js";
import { readNpmLock } from "../detectors/lock-file.js";
import { readEnvState } from "../detectors/env.js";
import { readGitState } from "../detectors/git.js";
import { detectPorts } from "../detectors/ports.js";
import { scanImports } from "../detectors/imports.js";
import { checkNodeProject } from "../checks/node.js";
import { checkNodeVersion } from "../checks/node-version.js";
import { checkPackageJson } from "../checks/package-json.js";
import { checkDependencies } from "../checks/dependencies.js";
import { checkEnv } from "../checks/env.js";
import { checkGit } from "../checks/git.js";
import { checkPortConflicts } from "../checks/port-conflict.js";
import { checkDependencyUsage } from "../checks/dependency-usage.js";
import { computeHealthScore } from "./score.js";

export async function scanProject(root: string): Promise<ScanResult> {
  const absoluteRoot = resolve(root);

  if (!(await directoryExists(absoluteRoot))) {
    const diagnostics: Diagnostic[] = [
      {
        id: "project.directory-missing",
        severity: "critical",
        title: "Project directory not found",
        message: `Directory does not exist: ${absoluteRoot}`,
        recommendation: "Check the path and run RepoDoctor again.",
      },
    ];
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
      diagnostics,
      health: computeHealthScore(diagnostics),
    };
  }

  const [files, packageManager, packageJson, envState] = await Promise.all([
    detectProjectFiles(absoluteRoot),
    detectPackageManager(absoluteRoot),
    readPackageJson(absoluteRoot),
    readEnvState(absoluteRoot),
  ]);

  const npmLock = packageManager.manager === "npm" ? await readNpmLock(absoluteRoot) : null;
  const git = files.gitRepo ? await readGitState(absoluteRoot) : null;
  const ports = await detectPorts(absoluteRoot, packageJson.content);
  const imports = await scanImports(absoluteRoot);

  const diagnostics = await buildDiagnostics({
    root: absoluteRoot,
    files,
    packageManager,
    packageJson,
    npmLock,
    envState,
    git,
    ports,
    imports,
  });
  const health = computeHealthScore(diagnostics);

  return {
    root: absoluteRoot,
    ...files,
    packageManager,
    packageJson,
    diagnostics,
    health,
  };
}

interface BuildContext {
  root: string;
  files: ProjectFacts;
  packageManager: PackageManagerDetection;
  packageJson: PackageJsonResult;
  npmLock: NpmLockResult | null;
  envState: EnvState;
  git: GitState | null;
  ports: PortSource[];
  imports: ImportScan;
}

async function buildDiagnostics(ctx: BuildContext): Promise<Diagnostic[]> {
  const { root, files, packageManager, packageJson, npmLock, envState, git, ports, imports } = ctx;
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
  diagnostics.push(
    ...checkDependencies({
      data: packageJson.content,
      nodeModulesInstalled: files.nodeModulesInstalled,
      packageManager,
      npmLock,
    }),
  );
  diagnostics.push(...checkEnv(envState));
  diagnostics.push(...checkGit(git, files.gitRepo));
  diagnostics.push(...(await checkPortConflicts(ports)));
  diagnostics.push(...checkDependencyUsage({ data: packageJson.content, imports }));

  return diagnostics;
}