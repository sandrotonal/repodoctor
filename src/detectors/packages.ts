import type { PackageJsonData } from "../core/types.js";

export interface DeprecatedPackageInfo {
  name: string;
  version?: string;
  reason: string;
  replacement?: string;
}

export interface TyposquatPackageInfo {
  name: string;
  targetPackage: string;
}

export interface InstallScriptRisk {
  scriptName: string;
  command: string;
  reason: string;
}

export interface InsecureDependencyRisk {
  name: string;
  version: string;
  type: "http-url" | "unpinned-git" | "wildcard-version";
  reason: string;
}

export interface PackageSupplyChainResult {
  deprecated: DeprecatedPackageInfo[];
  typosquats: TyposquatPackageInfo[];
  installScriptRisks: InstallScriptRisk[];
  insecureDependencies: InsecureDependencyRisk[];
  missingLicense: boolean;
  copyleftLicense: string | null;
}

// Known deprecated packages in the JavaScript/Node.js ecosystem
const DEPRECATED_PACKAGES: Record<string, { reason: string; replacement?: string }> = {
  request: { reason: "Package has been deprecated and unmaintained since 2020.", replacement: "fetch, axios, or got" },
  "request-promise": { reason: "Deprecated along with 'request'.", replacement: "fetch, axios, or got" },
  "request-promise-native": { reason: "Deprecated along with 'request'.", replacement: "fetch, axios, or got" },
  querystring: { reason: "Deprecated Node.js built-in API module.", replacement: "URLSearchParams" },
  nomnom: { reason: "Package deprecated and unmaintained.", replacement: "commander, yargs, or citty" },
  "babel-eslint": { reason: "Deprecated in favor of @babel/eslint-parser.", replacement: "@babel/eslint-parser" },
  tslint: { reason: "Deprecated in 2019 in favor of typescript-eslint.", replacement: "typescript-eslint or biome" },
  "core-js@2": { reason: "core-js v2 is unmaintained and contains outdated polyfills.", replacement: "core-js@3" },
  urllib: { reason: "Outdated and has multiple known high CVEs.", replacement: "undici or fetch" },
  "node-uuid": { reason: "Deprecated package name.", replacement: "uuid" },
  colors: { reason: "Known historical supply-chain disruption issues.", replacement: "chalk, picocolors, or colorette" },
};

// Known explicit typosquat mapping
const TYPOSQUAT_PATTERNS: Record<string, string> = {
  "cross-env.js": "cross-env",
  "crossenv": "cross-env",
  "loadsh": "lodash",
  "lodas": "lodash",
  "expresss": "express",
  "expres": "express",
  "electorn": "electron",
  "react-domm": "react-dom",
  "mongodbb": "mongodb",
  "typescrit": "typescript",
  "typescrypt": "typescript",
  "coookie-parser": "cookie-parser",
};

// Popular target packages used for distance-based similarity scoring
const POPULAR_PACKAGES = [
  "react",
  "react-dom",
  "vue",
  "express",
  "lodash",
  "axios",
  "typescript",
  "next",
  "eslint",
  "prettier",
  "chalk",
  "moment",
  "jest",
  "vitest",
  "webpack",
  "rollup",
  "vite",
  "rxjs",
  "dotenv",
  "cross-env",
  "commander",
];

const COPYLEFT_LICENSES = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "GPL", "AGPL"]);

const DANGEROUS_INSTALL_SCRIPTS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /curl\s+.*?\|\s*(?:ba)?sh/i,
    reason: "Pipes remote script from curl directly into shell interpreter",
  },
  {
    pattern: /wget\s+.*?\|\s*(?:ba)?sh/i,
    reason: "Pipes remote script from wget directly into shell interpreter",
  },
  {
    pattern: /powershell\s+-(?:enc|encodedcommand)\b/i,
    reason: "Executes obfuscated base64 PowerShell command",
  },
  {
    pattern: /base64\s+-d\s*\|\s*(?:ba)?sh/i,
    reason: "Decodes and executes obfuscated base64 shell command",
  },
  {
    pattern: /(?:nc|netcat)\s+-e/i,
    reason: "Reverse shell command pattern detected",
  },
  {
    pattern: /rm\s+-rf\s+(?:\/|\/\*|~|\$HOME)(?:\s|$)/i,
    reason: "Attempts to delete root or home directory recursively",
  },
];

/**
 * Calculates Levenshtein distance between two strings for typosquat similarity detection.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

export function checkPackageSupplyChain(pkg: PackageJsonData | null): PackageSupplyChainResult {
  if (!pkg) {
    return {
      deprecated: [],
      typosquats: [],
      installScriptRisks: [],
      insecureDependencies: [],
      missingLicense: false,
      copyleftLicense: null,
    };
  }

  const allDependencies: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };

  const deprecated: DeprecatedPackageInfo[] = [];
  const typosquats: TyposquatPackageInfo[] = [];
  const installScriptRisks: InstallScriptRisk[] = [];
  const insecureDependencies: InsecureDependencyRisk[] = [];

  // 1. Check install lifecycle scripts in package.json
  if (pkg.scripts && typeof pkg.scripts === "object") {
    const lifecycleScriptNames = ["preinstall", "install", "postinstall", "prepublish", "prepublishOnly"];
    for (const scriptName of lifecycleScriptNames) {
      const command = pkg.scripts[scriptName];
      if (typeof command === "string") {
        for (const { pattern, reason } of DANGEROUS_INSTALL_SCRIPTS) {
          if (pattern.test(command)) {
            installScriptRisks.push({
              scriptName,
              command,
              reason,
            });
            break;
          }
        }
      }
    }
  }

  // 2. Check dependencies for deprecations, typosquats, and insecure protocols
  for (const [name, version] of Object.entries(allDependencies)) {
    if (typeof version !== "string") continue;

    // A. Check deprecated
    if (name in DEPRECATED_PACKAGES) {
      const info = DEPRECATED_PACKAGES[name]!;
      deprecated.push({
        name,
        version,
        reason: info.reason,
        replacement: info.replacement,
      });
    }

    // B. Check typosquat patterns
    const lowerName = name.toLowerCase();
    if (lowerName in TYPOSQUAT_PATTERNS) {
      typosquats.push({
        name,
        targetPackage: TYPOSQUAT_PATTERNS[lowerName]!,
      });
    } else if (!POPULAR_PACKAGES.includes(lowerName)) {
      // Check similarity distance against popular packages
      for (const pop of POPULAR_PACKAGES) {
        if (Math.abs(lowerName.length - pop.length) > 2) continue;
        const dist = levenshteinDistance(lowerName, pop);
        if (dist === 1) {
          typosquats.push({
            name,
            targetPackage: pop,
          });
          break;
        }
      }
    }

    // C. Check insecure dependency protocols
    const trimmedVersion = version.trim();
    if (trimmedVersion.startsWith("http://")) {
      insecureDependencies.push({
        name,
        version: trimmedVersion,
        type: "http-url",
        reason: "Insecure HTTP URL dependency is susceptible to MITM packet tampering",
      });
    } else if (
      trimmedVersion.startsWith("git://") ||
      trimmedVersion.startsWith("git+http://") ||
      (trimmedVersion.startsWith("git+https://") && !trimmedVersion.includes("#"))
    ) {
      insecureDependencies.push({
        name,
        version: trimmedVersion,
        type: "unpinned-git",
        reason: "Unpinned git dependency without commit hash is non-reproducible and prone to supply-chain tampering",
      });
    } else if (trimmedVersion === "*" || trimmedVersion === "latest" || trimmedVersion === "x") {
      insecureDependencies.push({
        name,
        version: trimmedVersion,
        type: "wildcard-version",
        reason: "Wildcard or 'latest' version allows unreviewed breaking changes and malicious releases",
      });
    }
  }

  // 3. Check license
  const license = typeof pkg.license === "string" ? pkg.license.trim() : null;
  const missingLicense = !license && Boolean(pkg.name);
  const copyleftLicense = license && COPYLEFT_LICENSES.has(license) ? license : null;

  return {
    deprecated,
    typosquats,
    installScriptRisks,
    insecureDependencies,
    missingLicense,
    copyleftLicense,
  };
}
