import { spawnSync } from "node:child_process";

const audit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--omit=dev", "--omit=peer", "--json"],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
);
if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  throw new Error(`npm audit did not return a JSON report: ${audit.stderr.trim()}`);
}

const acceptedNames = new Set(["@prisma/config", "deepmerge-ts", "prisma"]);
const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const unexpected = vulnerabilities.filter(
  ([name, finding]) =>
    !acceptedNames.has(name) ||
    (finding.severity !== "high" && finding.severity !== "moderate" && finding.severity !== "low"),
);
const deepMergeFinding = report.vulnerabilities?.["deepmerge-ts"];
const acceptedAdvisoryPresent = deepMergeFinding?.via?.some(
  (item) =>
    typeof item === "object" && item.url === "https://github.com/advisories/GHSA-ggr8-5vv4-36mx",
);
if (unexpected.length > 0 || (vulnerabilities.length > 0 && !acceptedAdvisoryPresent)) {
  const names = unexpected.map(([name]) => name).join(", ") || "unrecognized advisory chain";
  throw new Error(`Dependency audit contains unaccepted findings: ${names}.`);
}

process.stdout.write(
  vulnerabilities.length === 0
    ? "Dependency audit passed with no findings.\n"
    : "Dependency audit passed with only the documented Prisma CLI advisory exception.\n",
);
