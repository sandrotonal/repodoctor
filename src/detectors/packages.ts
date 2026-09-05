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

export interface PackageSupplyChainResult {
  deprecated: DeprecatedPackageInfo[];
  typosquats: TyposquatPackageInfo[];
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

// Known typosquat packages that trick developers
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

const COPYLEFT_LICENSES = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "GPL", "AGPL"]);

export function checkPackageSupplyChain(pkg: PackageJsonData | null): PackageSupplyChainResult {
  if (!pkg) {
    return {
      deprecated: [],
      typosquats: [],
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

  for (const [name, version] of Object.entries(allDependencies)) {
    // Check deprecated
    if (name in DEPRECATED_PACKAGES) {
      const info = DEPRECATED_PACKAGES[name]!;
      deprecated.push({
        name,
        version,
        reason: info.reason,
        replacement: info.replacement,
      });
    }

    // Check typosquat
    const lowerName = name.toLowerCase();
    if (lowerName in TYPOSQUAT_PATTERNS) {
      typosquats.push({
        name,
        targetPackage: TYPOSQUAT_PATTERNS[lowerName]!,
      });
    }
  }

  // Check license
  const license = typeof pkg.license === "string" ? pkg.license.trim() : null;
  const missingLicense = !license && Boolean(pkg.name);
  const copyleftLicense = license && COPYLEFT_LICENSES.has(license) ? license : null;

  return {
    deprecated,
    typosquats,
    missingLicense,
    copyleftLicense,
  };
}
