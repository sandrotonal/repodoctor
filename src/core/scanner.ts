import { resolve } from "node:path";
import type { Diagnostic, HealthScore, PackageJsonResult, PackageManagerDetection, ProjectFacts, ScanResult } from "./types.js";
import type { NpmLockResult } from "../detectors/lock-file.js";
import type { EnvState } from "../detectors/env.js";
import type { GitState } from "../detectors/git.js";
import type { PortSource } from "../detectors/ports.js";
import type { ImportScan } from "../detectors/imports.js";
import type { SecurityScan } from "../detectors/secrets.js";
import type { ConfigsState } from "../detectors/configs.js";
import type { FrameworkScanResult } from "../detectors/frameworks.js";
import type { WorkspaceScanResult } from "../detectors/workspaces.js";
import type { PackageSupplyChainResult } from "../detectors/packages.js";
import type { CiScanResult } from "../detectors/ci.js";
import { detectPackageManager } from "../detectors/package-manager.js";
import { readPackageJson } from "../detectors/package-json.js";
import { detectProjectFiles, directoryExists } from "../detectors/project.js";
import { readNpmLock } from "../detectors/lock-file.js";
import { readEnvState } from "../detectors/env.js";
import { readGitState } from "../detectors/git.js";
import { detectPorts } from "../detectors/ports.js";
import { scanImports } from "../detectors/imports.js";
import { scanSecrets } from "../detectors/secrets.js";
import { detectConfigs } from "../detectors/configs.js";
import { detectFrameworks } from "../detectors/frameworks.js";
import { detectWorkspaces } from "../detectors/workspaces.js";
import { checkPackageSupplyChain } from "../detectors/packages.js";
import { detectCiWorkflows } from "../detectors/ci.js";
import { checkNodeProject } from "../checks/node.js";
import { checkNodeVersion } from "../checks/node-version.js";
import { checkPackageJson } from "../checks/package-json.js";
import { checkDependencies } from "../checks/dependencies.js";
import { checkEnv } from "../checks/env.js";
import { checkGit } from "../checks/git.js";
import { checkPortConflicts } from "../checks/port-conflict.js";
import { checkDependencyUsage } from "../checks/dependency-usage.js";
import { checkSecurity } from "../checks/security.js";
import { checkConfigs } from "../checks/configs.js";
import { checkFrameworks } from "../checks/frameworks.js";
import { checkWorkspaces } from "../checks/workspaces.js";
import { checkPackages } from "../checks/packages.js";
import { checkCi } from "../checks/ci.js";
import { computeHealthScore } from "./score.js";

export interface ScanOptions {
  onProgress?: (label: string) => void;
}

export async function scanProject(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const absoluteRoot = resolve(root);
  const { onProgress } = options;

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
    track(detectProjectFiles(absoluteRoot), "Detecting project structure", onProgress),
    track(detectPackageManager(absoluteRoot), "Detecting package manager", onProgress),
    track(readPackageJson(absoluteRoot), "Reading package.json", onProgress),
    track(readEnvState(absoluteRoot), "Checking environment variables", onProgress),
  ]);

  const npmLock =
    packageManager.manager === "npm" ? await track(readNpmLock(absoluteRoot), "Reading npm lock file", onProgress) : null;
  const git = files.gitRepo ? await track(readGitState(absoluteRoot), "Inspecting git state", onProgress) : null;
  const ports = await track(detectPorts(absoluteRoot, packageJson.content), "Checking configured ports", onProgress);
  const imports = await track(scanImports(absoluteRoot), "Scanning source imports", onProgress);
  const security = await track(scanSecrets(absoluteRoot, packageJson.content), "Scanning for secrets and security risks", onProgress);
  const configs = await track(detectConfigs(absoluteRoot), "Checking TypeScript and tooling configs", onProgress);
  const frameworks = await track(detectFrameworks(absoluteRoot, packageJson.content), "Analyzing web frameworks", onProgress);
  const workspaces = await track(detectWorkspaces(absoluteRoot, packageJson.content), "Scanning monorepo workspaces", onProgress);
  const packages = checkPackageSupplyChain(packageJson.content);
  const ci = await track(detectCiWorkflows(absoluteRoot), "Scanning CI/CD workflows", onProgress);

  onProgress?.("Evaluating diagnostics");
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
    security,
    configs,
    frameworks,
    workspaces,
    packages,
    ci,
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
  security: SecurityScan;
  configs: ConfigsState;
  frameworks: FrameworkScanResult;
  workspaces: WorkspaceScanResult;
  packages: PackageSupplyChainResult;
  ci: CiScanResult;
}

async function track<T>(promise: Promise<T>, label: string, onProgress?: (label: string) => void): Promise<T> {
  const value = await promise;
  onProgress?.(label);
  return value;
}

async function buildDiagnostics(ctx: BuildContext): Promise<Diagnostic[]> {
  const { root, files, packageManager, packageJson, npmLock, envState, git, ports, imports, security, configs, frameworks, workspaces, packages, ci } = ctx;
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
  diagnostics.push(...checkSecurity(security));
  diagnostics.push(...checkConfigs(configs));
  diagnostics.push(...checkFrameworks(frameworks));
  diagnostics.push(...checkWorkspaces(workspaces));
  diagnostics.push(...checkPackages(packages));
  diagnostics.push(...checkCi(ci));

  return diagnostics;
}