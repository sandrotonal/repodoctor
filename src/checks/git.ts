import type { Diagnostic } from "../core/types.js";
import type { GitState } from "../detectors/git.js";

export function checkGit(state: GitState | null, gitRepoDetected: boolean): Diagnostic[] {
  if (!gitRepoDetected) {
    return [];
  }

  if (state === null) {
    return [
      {
        id: "git.unavailable",
        severity: "info",
        title: "Git working tree state unavailable",
        message: "Could not read the git working tree state.",
      },
    ];
  }

  const diagnostics: Diagnostic[] = [
    {
      id: "git.state",
      severity: "success",
      title: "Git working tree checked",
      message: state.branch ? `On branch ${state.branch}` : "Detached HEAD",
    },
  ];

  if (state.dirty) {
    diagnostics.push({
      id: "git.dirty",
      severity: "warning",
      title: "Uncommitted changes",
      message: `The working tree has uncommitted changes (${state.untracked} untracked files).`,
      recommendation: "Commit or stash changes before debugging unrelated issues.",
    });
  }

  return diagnostics;
}