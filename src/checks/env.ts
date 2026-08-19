import type { Diagnostic } from "../core/types.js";
import type { EnvState } from "../detectors/env.js";

export function checkEnv(state: EnvState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!state.envFileExists && !state.exampleExists) {
    return diagnostics;
  }

  if (!state.envFileExists && state.exampleExists) {
    diagnostics.push({
      id: "env.missing",
      severity: "warning",
      title: "No .env file found",
      message: ".env.example exists; a local .env file is expected.",
      recommendation: "Copy .env.example to .env and fill in your local values.",
    });
  }

  if (state.envFileExists && !state.exampleExists) {
    diagnostics.push({
      id: "env.example-missing",
      severity: "info",
      title: "No .env.example found",
      message: "A local .env exists but there is no .env.example for other developers.",
      recommendation: "Create an .env.example with placeholder values (never commit real secrets).",
    });
  }

  if (state.envFileExists && !state.envGitIgnored) {
    diagnostics.push({
      id: "env.not-gitignored",
      severity: "warning",
      title: ".env is not gitignored",
      message: "A local .env file is present but .gitignore does not ignore it.",
      recommendation: "Add .env and .env.local to .gitignore to avoid leaking secrets.",
    });
  }

  if (state.envFileExists && state.exampleExists) {
    const missing = state.exampleKeys.filter((key) => !state.envKeys.includes(key));
    if (missing.length > 0) {
      diagnostics.push({
        id: "env.keys-missing",
        severity: "warning",
        title: "Missing environment variables",
        message: missing.join(", "),
        recommendation: "Add these keys to your local .env file.",
      });
    }

    const extra = state.envKeys.filter((key) => !state.exampleKeys.includes(key));
    if (extra.length > 0) {
      diagnostics.push({
        id: "env.extra-keys",
        severity: "info",
        title: "Extra environment variables",
        message: extra.join(", "),
        recommendation: "Consider documenting unexpected keys in .env.example.",
      });
    }
  }

  return diagnostics;
}