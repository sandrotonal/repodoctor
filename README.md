<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Next.js-000000.svg?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Vite-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Monorepo-pnpm%20%7C%20Turbo-F69220.svg?style=for-the-badge&logo=pnpm&logoColor=white" alt="Monorepo">
  <img src="https://img.shields.io/badge/Security-Secret%20Scanner-red.svg?style=for-the-badge&logo=securityscorecard&logoColor=white" alt="Security">
  <img src="https://img.shields.io/badge/SARIF-GitHub%20Code%20Scanning-blue.svg?style=for-the-badge&logo=githubactions&logoColor=white" alt="SARIF">
  <img src="https://img.shields.io/badge/Test-Vitest%20(152%20passed)-2EA44F?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest">
  <img src="https://img.shields.io/badge/Zero_Leak-Shannon_Entropy-blueviolet?style=for-the-badge&logo=auth0&logoColor=white" alt="Zero Leak">
  <img src="https://img.shields.io/badge/Baseline-SHA--256-ff69b4?style=for-the-badge&logo=git&logoColor=white" alt="Baseline">
  <img src="https://img.shields.io/github/license/sandrotonal/repodoctor?style=for-the-badge&logo=opensourceinitiative&color=8A2BE2" alt="License">
</p>

# RepoDoctor

> **Local-first repository health, security, framework, and monorepo diagnostic engine.**  
> Diagnose why your project fails to install, build, or deploy — and catch leaked secrets before you push.

RepoDoctor inspects your codebase locally in milliseconds. Your code **never leaves your machine**.

---

## What's New in v0.6.0 (Enterprise Hardening)

- **Zero Raw Secret Leakage**: API keys and tokens are securely masked in memory at detection time (`AKIA****PLE`). Raw secrets are never saved, printed, or leaked into JSON, SARIF, or HTML outputs.
- **Shannon Entropy Confidence Scoring**: Eliminates false positives by evaluating mathematical entropy ($H = -\sum p \log_2 p$) for high-entropy tokens, while suppressing dummy & documentation keys (`AKIAIOSFODNN7EXAMPLE`, `sk_test_...`).
- **`.repodoctorignore` Engine**: Glob-based and rule-specific suppression support (`repodoctor init-ignore`, `--ignore-file`).
- **Deterministic Baseline Snapshotting**: Stabilized SHA-256 fingerprinting (`--baseline`, `--update-baseline`, `--new-only`) allows gradual adoption on legacy brownfield projects without breaking CI builds.
- **Decoupled Dual Scoring**: Separate **Security Health (0–100)** and **Reliability Health (0–100)** scoring so non-critical lints never mask active security leaks.
- **TypeScript Compiler API AST Parser**: Source import scanning uses true AST parsing, completely eliminating false positives from code comments (`// import "pkg"`) and string literals.
- **Multi-Package Manager CI Generation**: Command `init-ci -p <npm|pnpm|yarn|bun>` tailors GitHub Actions pipelines with respective setup actions and execution tools (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`).
- **Safe Auto-Fix with Dry-Run**: Preview configuration fixes as unified diffs (`repodoctor --fix --dry-run`) protected by strict symlink and path traversal guards.
- **Transparent Scan Coverage**: Real-time tracking of files discovered, files scanned, files skipped, and duration in milliseconds.

---

## Quick Start

No installation required:

```bash
npx @gucluyumhe/repodoctor
```

Generate a `.repodoctorignore` template:

```bash
npx @gucluyumhe/repodoctor init-ignore
```

Install automated CI workflow (supports npm, pnpm, yarn, bun):

```bash
npx @gucluyumhe/repodoctor init-ci
```

Install git pre-commit protection in 1 second:

```bash
npx @gucluyumhe/repodoctor init-hook
```

---

## Features & Diagnostic Modules

| Module | What RepoDoctor Detects |
| :--- | :--- |
| **Security & Secrets** | Real-time scanner for **hardcoded API keys** (Google Gemini, Anthropic Claude, OpenAI, AWS, HuggingFace, GitHub, Stripe, Slack, Discord, Telegram, JWTs, Private RSA/SSH Keys, Database credentials with passwords) with **Shannon entropy analysis**, dummy credential suppression, and **zero raw secret leakage** (strict in-memory masking). |
| **Package Supply Chain** | Detects **deprecated packages** (`request`, `tslint`, `nomnom`, `urllib`, `colors`, etc.), **typosquatting attacks** (`cross-env.js`, `crossenv`), missing licenses, and restrictive copyleft licenses (`GPL`, `AGPL`). |
| **CI/CD Workflow Health** | Scans `.github/workflows/` for missing checkouts, missing Node.js setup, unpinned action versions, missing node-version declarations, and unmonitored pull requests. |
| **Framework Health** | Deep checks for **Next.js** (`"use client"` components leaking `server-only` or database clients), **Vite & Next.js Env Prefix Mismatches** (e.g. using `NEXT_PUBLIC_` in Vite or `VITE_` in Next.js), and missing **TailwindCSS / PostCSS** configurations. |
| **Monorepo & Workspaces** | Inspects **pnpm workspaces**, **Turborepo**, **Lerna**, and **npm/yarn workspaces**. Flags **dependency version drift** across workspace sub-packages (`packages/*`, `apps/*`). |
| **TypeScript Health** | Validates `tsconfig.json`, flags disabled `strict` mode, missing `skipLibCheck`, and orphan `.ts` files without a configuration. |
| **Docker & DevOps** | Detects `Dockerfile` without `.dockerignore`, ensuring `node_modules`, `.env`, and `.git` are not accidentally leaked into image build contexts. |
| **Dependencies & Lockfiles** | Detects package managers (`npm`, `yarn`, `pnpm`, `bun`), ambiguous lockfiles, lockfile desyncs, plus **unused** & **undeclared** packages via **true TypeScript Compiler AST parsing** (ignoring code comments). |
| **Environment & Git** | Validates `.env` against `.env.example` key mismatches, checks unignored `.env` files (values are **never** logged or exported), and monitors git tree status. |
| **Live Port Conflicts** | Binds live TCP sockets to detect if ports declared in `.env` (`PORT=3000`) or `package.json` are already in use. |
| **Deterministic Baselines** | SHA-256 fingerprint snapshotting (`--baseline`, `--update-baseline`, `--new-only`) to suppress legacy findings on brownfield repositories. |
| **Dual Health Scoring** | Decoupled **Security Health (0–100)** and **Reliability Health (0–100)** scoring so non-critical lints never obscure active secret leaks. |
| **Multi-Format Export** | Beautiful terminal panel UI with animations, pure JSON (`--json`), **Interactive Dark-mode HTML Dashboard** (`--html`), **SARIF 2.1.0** for GitHub Code Scanning, and **GitHub Flavored Markdown** (`--markdown`) for Step Summaries. |
| **Smart Auto-Fix & Dry-Run** | Safely repairs configuration drift (`--fix`) with **path traversal guards**, **symlink guards**, and unified diff previews (`--fix --dry-run`). |

---

## Usage & CLI Options

```bash
repodoctor                             # Run diagnosis on current directory
repodoctor ./path/to/project           # Run diagnosis on a specific repository
repodoctor init-ignore                 # Create a default .repodoctorignore template
repodoctor init-ci                     # Generate GitHub Actions CI workflow (auto-detects npm, pnpm, yarn, bun)
repodoctor init-ci -p pnpm             # Generate GitHub Actions CI workflow for pnpm
repodoctor init-hook                   # Install git pre-commit hook to block secret leaks
repodoctor --baseline .baseline.json   # Suppress known issues recorded in baseline snapshot
repodoctor --baseline .baseline.json --update-baseline # Generate or refresh baseline snapshot
repodoctor --ci --new-only             # CI mode: exit non-zero only on new issues not in baseline
repodoctor --html report.html          # Generate interactive standalone HTML dashboard
repodoctor --markdown summary.md       # Generate GitHub Flavored Markdown summary for CI
repodoctor --sarif results.sarif       # Export SARIF 2.1.0 for GitHub Security tab
repodoctor --fix                       # Apply safe automated fixes
repodoctor --fix --dry-run             # Preview automated fixes as unified diffs without touching files
repodoctor --max-files 2000            # Limit scan to 2,000 files for high-speed audits
repodoctor --max-file-size 512         # Skip files larger than 512 KB
repodoctor --ci                        # Non-zero exit code on warnings or critical errors
repodoctor --json                      # Machine-readable JSON output
repodoctor --style plain               # Plain text mode (default in non-TTY/CI)
repodoctor --style panel               # Rich gradient panel UI with health gauge
```

---

## Suppressions via `.repodoctorignore`

Ignore specific files or fine-grained rules by creating a `.repodoctorignore` in your project root:

```gitignore
# Exclude entire directories from all scans
tests/fixtures/**
examples/**
docs/**

# Rule-specific suppression: <rule-id>:<file-pattern>
secret.aws-key:examples/aws-demo.ts
framework.tailwind.missing-config:packages/legacy-app/**
```

---

## Deterministic Baseline Snapshotting

Adopt RepoDoctor on large brownfield repositories without failing existing builds:

```bash
# 1. Snapshot all existing legacy findings
npx @gucluyumhe/repodoctor --baseline .repodoctor-baseline.json --update-baseline

# 2. In CI, only fail pull requests that introduce NEW issues
npx @gucluyumhe/repodoctor --ci --baseline .repodoctor-baseline.json --new-only
```

---

## Safe Auto-Fix Engine & Dry-Run (`--fix`, `--dry-run`)

RepoDoctor can safely repair configuration drift without touching your core application logic. Test changes safely before applying them:

```bash
# Preview what would change via unified diffs (0 files modified)
npx @gucluyumhe/repodoctor --fix --dry-run

# Apply verified fixes
npx @gucluyumhe/repodoctor --fix
```

- **Symlink & Path Traversal Protected**: Prevents attacks targeting symlinks or malicious rule filenames.
- **Generates minimal `tsconfig.json`** if TypeScript files exist without a configuration.
- **Creates `tailwind.config.js`** if Tailwind is installed in dependencies but unconfigured.
- **Generates `.env.example`** from `.env` keys with placeholder values.
- **Creates optimized `.dockerignore`** excluding `node_modules`, `.env`, and `.git`.
- **Adds unignored `.env`, `.env.local`, and sensitive certificate/key files** (`.pem`, `.key`, `id_rsa`) to `.gitignore`.

---

## Interactive HTML Dashboard (`--html report.html`)

Generate a standalone, zero-dependency HTML report to review with your team or attach to CI artifacts:

```bash
npx @gucluyumhe/repodoctor --html ./repodoctor-report.html
```

- **Sleek Dark Theme UI** with responsive layout.
- **Dual Score Gauges**: Overall Health, Security Health, and Reliability Health (0–100).
- **Scan Coverage Metrics**: Files scanned, files skipped, and duration in milliseconds.
- **Interactive Filtering** by severity (Critical, Warning, Info, Passed).
- **Hardened Security**: Complete HTML escaping preventing XSS injection.

---

## GitHub Actions CI/CD Integration

Set up automated pull request scanning in 1 second:

```bash
npx @gucluyumhe/repodoctor init-ci
```

Or tailor it for your package manager (`pnpm`, `yarn`, `bun`, `npm`):

```bash
npx @gucluyumhe/repodoctor init-ci -p pnpm
```

Generated `.github/workflows/repodoctor.yml`:

```yaml
name: RepoDoctor Health & Security Scan

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  repodoctor:
    name: RepoDoctor Health & Security Scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Run RepoDoctor Diagnostic Scan
        run: npx @gucluyumhe/repodoctor --ci --sarif repodoctor.sarif --markdown $GITHUB_STEP_SUMMARY

      - name: Upload Security SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: repodoctor.sarif
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

# Run test suite with Vitest (152 tests)
npm test
```

---

## License

MIT © [Ömer Özbay](https://gucluyumhe.dev/)
