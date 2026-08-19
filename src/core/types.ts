export type Severity = "critical" | "warning" | "info" | "success";

export interface Diagnostic {
  id: string;
  severity: Severity;
  title: string;
  message?: string;
  recommendation?: string;
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface PackageManagerDetection {
  manager: PackageManager | null;
  lockFiles: string[];
  ambiguous: boolean;
}

export interface ProjectFacts {
  projectDetected: boolean;
  packageJsonExists: boolean;
  gitRepo: boolean;
  nodeModulesInstalled: boolean;
  envFileExists: boolean;
  envExampleExists: boolean;
  envFiles: string[];
}

export interface ScanResult extends ProjectFacts {
  root: string;
  packageManager: PackageManagerDetection;
  diagnostics: Diagnostic[];
}