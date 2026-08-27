import type { Diagnostic } from "../core/types.js";
import type { ConfigsState } from "../detectors/configs.js";

export function checkConfigs(state: ConfigsState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 1. TypeScript Checks
  const { typescript, docker, exposedFiles } = state;

  if (typescript.hasTsFiles && !typescript.exists) {
    diagnostics.push({
      id: "typescript.missing-config",
      severity: "warning",
      title: "TypeScript source files found without tsconfig.json",
      message: "Found .ts/.tsx files but no tsconfig.json in project root.",
      recommendation: "Initialize TypeScript configuration using 'npx tsc --init'.",
    });
  } else if (typescript.exists) {
    if (!typescript.valid) {
      diagnostics.push({
        id: "typescript.invalid-config",
        severity: "critical",
        title: "Invalid tsconfig.json",
        message: typescript.parseError ?? "Could not parse tsconfig.json.",
        recommendation: "Fix syntax errors in tsconfig.json.",
      });
    } else {
      if (!typescript.strict) {
        diagnostics.push({
          id: "typescript.strict-disabled",
          severity: "warning",
          title: "TypeScript strict mode is disabled",
          message: "compilerOptions.strict is not enabled in tsconfig.json.",
          recommendation: "Set '\"strict\": true' in tsconfig.json for optimal type safety.",
        });
      } else {
        diagnostics.push({
          id: "typescript.strict-enabled",
          severity: "success",
          title: "TypeScript strict mode enabled",
          message: `target: ${typescript.target ?? "default"}`,
        });
      }
    }
  }

  // 2. Docker Checks
  if (docker.hasDockerfile) {
    if (!docker.hasDockerignore) {
      diagnostics.push({
        id: "docker.missing-dockerignore",
        severity: "warning",
        title: "Dockerfile present without .dockerignore",
        message: `Found ${docker.dockerfileNames.join(", ")}, but no .dockerignore file exists.`,
        recommendation: "Create a .dockerignore file to exclude node_modules, .env, and .git from image build context.",
      });
    } else {
      const missingIgnores: string[] = [];
      if (!docker.ignoresNodeModules) missingIgnores.push("node_modules");
      if (!docker.ignoresEnv) missingIgnores.push(".env");
      if (!docker.ignoresGit) missingIgnores.push(".git");

      if (missingIgnores.length > 0) {
        diagnostics.push({
          id: "docker.dockerignore-incomplete",
          severity: "warning",
          title: ".dockerignore is missing critical exclusions",
          message: `The following paths are not ignored: ${missingIgnores.join(", ")}`,
          recommendation: "Add node_modules, .env, and .git to .dockerignore to keep images slim and secure.",
        });
      } else {
        diagnostics.push({
          id: "docker.dockerignore-valid",
          severity: "success",
          title: "Docker configuration and .dockerignore validated",
        });
      }
    }
  }

  // 3. Sensitive Exposed Files
  for (const exposed of exposedFiles) {
    diagnostics.push({
      id: `security.exposed-file:${exposed.name}`,
      severity: exposed.severity,
      title: `Sensitive file exposed in repository root: ${exposed.name}`,
      message: exposed.reason,
      recommendation: `Add '${exposed.name}' to .gitignore or remove it from the repository.`,
    });
  }

  return diagnostics;
}
