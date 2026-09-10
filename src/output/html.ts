import type { Diagnostic, ScanResult, Severity } from "../core/types.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    case "info":
      return "#3b82f6";
    case "success":
      return "#10b981";
  }
}

function severityBg(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "rgba(239, 68, 68, 0.15)";
    case "warning":
      return "rgba(245, 158, 11, 0.15)";
    case "info":
      return "rgba(59, 130, 246, 0.15)";
    case "success":
      return "rgba(16, 185, 129, 0.15)";
  }
}

function categoryOf(id: string): string {
  if (id.startsWith("secret") || id.startsWith("security")) return "Security";
  if (id.startsWith("packages.")) return "Packages";
  if (id.startsWith("ci.")) return "CI/CD";
  if (id.startsWith("framework")) return "Frameworks";
  if (id.startsWith("monorepo")) return "Monorepo";
  if (id.startsWith("typescript")) return "TypeScript";
  if (id.startsWith("docker")) return "Docker";
  if (id.startsWith("node")) return "Node.js";
  if (id.startsWith("package-") || id.startsWith("dependencies")) return "Dependencies";
  if (id.startsWith("env")) return "Environment";
  if (id.startsWith("git")) return "Git";
  if (id.startsWith("port")) return "Ports";
  return "Project";
}

export function generateHtmlReport(result: ScanResult): string {
  const counts = { critical: 0, warning: 0, info: 0, success: 0 };
  for (const d of result.diagnostics) {
    counts[d.severity] += 1;
  }

  const gradeColors: Record<string, string> = {
    excellent: "#10b981",
    good: "#10b981",
    fair: "#f59e0b",
    poor: "#d946ef",
    critical: "#ef4444",
  };

  const mainColor = gradeColors[result.health.grade] ?? "#10b981";

  // Group by category
  const categories = new Map<string, Diagnostic[]>();
  for (const d of result.diagnostics) {
    const cat = categoryOf(d.id);
    const list = categories.get(cat) ?? [];
    list.push(d);
    categories.set(cat, list);
  }

  const categoryCards = Array.from(categories.entries())
    .map(([cat, diags]) => {
      const rows = diags
        .map((d) => {
          const color = severityColor(d.severity);
          const bg = severityBg(d.severity);
          return `
          <div class="diag-item diag-${d.severity}">
            <div class="diag-header">
              <span class="diag-badge" style="color: ${color}; background: ${bg}; border-color: ${color}40;">
                ${d.severity.toUpperCase()}
              </span>
              <span class="diag-title">${escapeHtml(d.title)}</span>
            </div>
            ${d.message ? `<div class="diag-message">${escapeHtml(d.message)}</div>` : ""}
            ${
              d.recommendation
                ? `<div class="diag-recommendation"><strong>Fix:</strong> ${escapeHtml(d.recommendation)}</div>`
                : ""
            }
          </div>
        `;
        })
        .join("");

      return `
      <div class="category-card">
        <h2 class="category-title">${escapeHtml(cat)}</h2>
        <div class="diag-list">
          ${rows}
        </div>
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoDoctor Diagnostic Report - ${escapeHtml(result.root)}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --border: #1f293d;
      --text: #f3f4f6;
      --text-dim: #9ca3af;
      --accent: #00f2fe;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .header-left h1 {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .header-left p {
      color: var(--text-dim);
      font-size: 0.95rem;
      word-break: break-all;
    }
    .health-gauge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.3);
      padding: 1.25rem 2rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .health-score {
      font-size: 2.75rem;
      font-weight: 900;
      color: ${mainColor};
    }
    .health-grade {
      text-transform: uppercase;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: ${mainColor};
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
    }
    .stat-number {
      font-size: 1.75rem;
      font-weight: 800;
      margin-bottom: 0.25rem;
    }
    .stat-label {
      color: var(--text-dim);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      border-color: #00f2fe;
      background: rgba(0, 242, 254, 0.1);
      color: #00f2fe;
    }
    .category-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .category-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .diag-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .diag-item {
      background: rgba(0,0,0,0.25);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    .diag-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }
    .diag-badge {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid;
    }
    .diag-title {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .diag-message {
      color: var(--text-dim);
      font-size: 0.85rem;
      margin-top: 0.35rem;
      margin-left: 0.25rem;
    }
    .diag-recommendation {
      margin-top: 0.5rem;
      background: rgba(0, 242, 254, 0.06);
      border-left: 3px solid #00f2fe;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border-radius: 0 4px 4px 0;
    }
    .footer {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
      margin-top: 3rem;
    }
    .footer a {
      color: #00f2fe;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <h1>RepoDoctor Diagnostic Report</h1>
        <p>Target: <code>${escapeHtml(result.packageJson.content?.name ? `${result.packageJson.content.name} (${result.root})` : result.root)}</code></p>
        ${
          result.coverage
            ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-dim);">
                Coverage: <strong>${result.coverage.filesScanned}</strong> files scanned (${result.coverage.bytesScanned ? `${(result.coverage.bytesScanned / 1024).toFixed(1)} KB, ` : ""}${result.coverage.filesSkipped} skipped${result.coverage.skippedReasons ? ` - ${result.coverage.skippedReasons.ignored} ignored, ${result.coverage.skippedReasons.binary} binary, ${result.coverage.skippedReasons.tooLarge} too large` : ""}) in <strong>${result.coverage.durationMs}ms</strong>
              </p>`
            : ""
        }
      </div>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div class="health-gauge">
          <div class="health-score">${result.health.score}</div>
          <div class="health-grade">${escapeHtml(result.health.grade)}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">OVERALL</div>
        </div>
        <div class="health-gauge">
          <div class="health-score" style="color: ${gradeColors[result.health.securityGrade ?? result.health.grade] ?? "#10b981"};">
            ${result.health.securityScore ?? result.health.score}
          </div>
          <div class="health-grade" style="color: ${gradeColors[result.health.securityGrade ?? result.health.grade] ?? "#10b981"};">
            ${escapeHtml(result.health.securityGrade ?? result.health.grade)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">SECURITY</div>
        </div>
        <div class="health-gauge">
          <div class="health-score" style="color: ${gradeColors[result.health.reliabilityGrade ?? result.health.grade] ?? "#10b981"};">
            ${result.health.reliabilityScore ?? result.health.score}
          </div>
          <div class="health-grade" style="color: ${gradeColors[result.health.reliabilityGrade ?? result.health.grade] ?? "#10b981"};">
            ${escapeHtml(result.health.reliabilityGrade ?? result.health.grade)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">RELIABILITY</div>
        </div>
      </div>
    </header>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-number" style="color: #ef4444;">${counts.critical}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #f59e0b;">${counts.warning}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #3b82f6;">${counts.info}</div>
        <div class="stat-label">Info</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #10b981;">${counts.success}</div>
        <div class="stat-label">Passed</div>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterDiags('all')">All (${result.diagnostics.length})</button>
      <button class="filter-btn" onclick="filterDiags('critical')">Critical (${counts.critical})</button>
      <button class="filter-btn" onclick="filterDiags('warning')">Warnings (${counts.warning})</button>
      <button class="filter-btn" onclick="filterDiags('info')">Info (${counts.info})</button>
      <button class="filter-btn" onclick="filterDiags('success')">Passed (${counts.success})</button>
    </div>

    <main id="category-container">
      ${categoryCards}
    </main>

    <footer class="footer">
      Generated by <a href="https://gucluyumhe.dev/" target="_blank">RepoDoctor</a> &bull; Fast, local-first repository health & security diagnostics.
    </footer>
  </div>

  <script>
    function filterDiags(severity) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      const items = document.querySelectorAll('.diag-item');
      items.forEach(item => {
        if (severity === 'all' || item.classList.contains('diag-' + severity)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });

      document.querySelectorAll('.category-card').forEach(card => {
        const visibleChildren = card.querySelectorAll('.diag-item[style*="display: block"], .diag-item:not([style*="display: none"])');
        card.style.display = (visibleChildren.length > 0) ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;
}
