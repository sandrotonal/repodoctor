import type { Diagnostic } from "../core/types.js";

export function checkNodeProject(packageJsonExists: boolean): Diagnostic[] {
  if (!packageJsonExists) {
    return [];
  }
  return [
    {
      id: "node.project",
      severity: "success",
      title: "Node.js project detected",
    },
  ];
}