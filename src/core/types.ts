export type Severity = "critical" | "warning" | "info" | "success";

export type DiagnosticConfidence = "high" | "medium" | "low" | "suppressed";

export interface DiagnosticLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface Diagnostic {
  id: string;
  severity: Severity;
  title: string;
  message?: string;
  recommendation?: string;
  category?: "security" | "reliability";
  confidence?: DiagnosticConfidence;
  location?: DiagnosticLocation;
  fingerprint?: string;
  fixable?: boolean;
  references?: string[];
  suppressed?: boolean;
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

export interface ScoreBreakdown {
  criticalDeductions: number;
  warningDeductions: number;
  baseScore: number;
}

export interface HealthScore {
  score: number;
  grade: HealthGrade;
  overallScore?: number;
  securityScore?: number;
  securityGrade?: HealthGrade;
  reliabilityScore?: number;
  reliabilityGrade?: HealthGrade;
  breakdown?: ScoreBreakdown;
  securityBreakdown?: ScoreBreakdown;
  reliabilityBreakdown?: ScoreBreakdown;
}

export interface ScanCoverage {
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  scanLimitReached: boolean;
  durationMs: number;
}

export interface ScanResult extends ProjectFacts {
  root: string;
  packageManager: PackageManagerDetection;
  packageJson: PackageJsonResult;
  diagnostics: Diagnostic[];
  health: HealthScore;
  coverage?: ScanCoverage;
}