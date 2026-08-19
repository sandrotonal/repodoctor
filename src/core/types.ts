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

export interface PackageJsonData {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string; [key: string]: unknown };
  packageManager?: string;
  [key: string]: unknown;
}

export interface PackageJsonResult {
  exists: boolean;
  content: PackageJsonData | null;
  parseError: string | null;
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

export type HealthGrade = "excellent" | "good" | "fair" | "poor" | "critical";

export interface HealthScore {
  score: number;
  grade: HealthGrade;
}

export interface ScanResult extends ProjectFacts {
  root: string;
  packageManager: PackageManagerDetection;
  packageJson: PackageJsonResult;
  diagnostics: Diagnostic[];
  health: HealthScore;
}