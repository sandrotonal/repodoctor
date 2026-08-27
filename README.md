<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Security-Secret%20Scanner-red.svg?style=for-the-badge&logo=securityscorecard&logoColor=white" alt="Security">
  <img src="https://img.shields.io/badge/SARIF-GitHub%20Code%20Scanning-blue.svg?style=for-the-badge&logo=githubactions&logoColor=white" alt="SARIF">
  <img src="https://img.shields.io/badge/Test-Vitest%20(110%20passed)-2EA44F?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest">
  <img src="https://img.shields.io/github/license/sandrotonal/repodoctor?style=for-the-badge&logo=opensourceinitiative&color=8A2BE2" alt="License">
</p>

# RepoDoctor

> **Local-first repository health, security, and configuration diagnostic engine.**  
> Diagnose why your project fails to install, build, or deploy — and catch leaked secrets before you push.

RepoDoctor inspects your codebase locally in milliseconds. Your code **never leaves your machine**.

---

## Quick Start

No installation required:

```bash
npx @gucluyumhe/repodoctor
```

---

## Features & Diagnostic Modules

| Module | What RepoDoctor Detects |
| :--- | :--- |
| **Security & Secrets** | Real-time scanner for **hardcoded API keys** (OpenAI, AWS, GitHub, Stripe, Slack, Private RSA/SSH Keys, Database credentials with passwords) & **malicious `package.json` scripts** (`curl \| sh`, `rm -rf /`, `chmod 777`). |
| **TypeScript Health** | Validates `tsconfig.json`, flags disabled `strict` mode, missing `skipLibCheck`, and orphan `.ts` files without a configuration. |
| **Docker & DevOps** | Detects `Dockerfile` without `.dockerignore`, ensuring `node_modules`, `.env`, and `.git` are not accidentally leaked into image build contexts. |
| **Dependencies & Lockfiles** | Detects package managers (`npm`, `yarn`, `pnpm`, `bun`), ambiguous lockfiles, lockfile desyncs, plus **unused** & **undeclared** packages via source AST scan. |
| **Environment & Git** | Validates `.env` against `.env.example` key mismatches, checks unignored `.env` files (values are **never** logged or exported), and monitors git tree status. |
| **Live Port Conflicts** | Binds live TCP sockets to detect if ports declared in `.env` (`PORT=3000`) or `package.json` are already in use. |
| **Multi-Format Export** | Beautiful terminal panel UI with animations, pure JSON (`--json`), **Interactive Dark-mode HTML Dashboard** (`--html`), and **SARIF 2.1.0** for GitHub Code Scanning. |
| **Smart Auto-Fix** | Automatically repairs common issues (`.gitignore`, `.dockerignore`, generating `.env.example` from `.env` keys). |

---

## Usage & CLI Options

```bash
repodoctor                        # Run diagnosis on current directory
repodoctor ./path/to/project      # Run diagnosis on a specific repository
repodoctor --html report.html     # Generate interactive standalone HTML dashboard
repodoctor --sarif results.sarif  # Export SARIF 2.1.0 for GitHub Security tab
repodoctor --fix                  # Apply safe automated fixes
repodoctor --ci                   # Non-zero exit code on warnings or critical errors
repodoctor --json                 # Machine-readable JSON output
repodoctor --style plain          # Plain text mode (default in non-TTY/CI)
repodoctor --style panel          # Rich gradient panel UI with health gauge
```

---

## Interactive HTML Dashboard (`--html report.html`)

Generate a standalone, zero-dependency HTML report to review with your team or attach to CI artifacts:

```bash
npx @gucluyumhe/repodoctor --html ./repodoctor-report.html
```

- **Sleek Dark Theme UI** with responsive layout.
- **Health Score Gauge** (0–100 with EXCELLENT / GOOD / FAIR / CRITICAL grades).
- **Interactive Filtering** by severity (Critical, Warning, Info, Passed).
- **Actionable Fix Recommendations** for every flagged diagnostic.

---

## GitHub Actions CI/CD Integration

Add RepoDoctor to your GitHub repository in 1 minute:

Create `.github/workflows/repodoctor.yml`:

```yaml
name: RepoDoctor Health & Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run RepoDoctor
        run: npx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif

      - name: Upload SARIF to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: repodoctor.sarif
```

---

## Smart Auto-Fix Engine (`--fix`)

RepoDoctor can safely repair configuration drift without modifying your application logic:

- Generates `.env.example` from `.env` keys with masked placeholder values.
- Creates optimized `.dockerignore` excluding `node_modules`, `.env`, and `.git`.
- Adds unignored `.env`, `.env.local`, and sensitive certificate/key files (`.pem`, `.key`, `id_rsa`) to `.gitignore`.

```bash
npx @gucluyumhe/repodoctor --fix
```

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/sandrotonal/repodoctor.git
cd repodoctor

# Install dependencies
npm install

# Run typecheck
npm run typecheck

# Build with tsup
npm run build

# Run test suite with Vitest (110 tests)
npm test
```

---

## License

MIT © [Ömer Özbay](https://gucluyumhe.dev/)
