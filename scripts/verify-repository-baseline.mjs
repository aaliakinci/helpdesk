import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  ".dockerignore",
  ".editorconfig",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  "README.md",
  "docs/dependency-policy.md",
  "docs/platform-baseline.md",
  "docs/decisions/README.md",
  "docs/decisions/template.md",
  "package-lock.json",
  "package.json",
];

const requiredDirectories = [
  "deploy",
  "src/server/apps/support-api",
  "src/server/apps/support-worker",
  "src/server/modules",
  "src/server/platform",
  "src/server/prisma",
  "src/web",
  "tests/unit",
  "tests/integration",
  "tests/contract",
  "tests/e2e",
];

const requiredDecisions = Array.from({ length: 12 }, (_, index) =>
  `docs/decisions/${String(index + 1).padStart(4, "0")}-`,
);

const failures = [];

if (process.versions.node !== "24.19.0") {
  failures.push(`Expected Node.js 24.19.0, received ${process.versions.node}.`);
}

for (const relativePath of [...requiredFiles, ...requiredDirectories]) {
  try {
    await access(path.join(repositoryRoot, relativePath), constants.F_OK);
  } catch {
    failures.push(`Missing required repository baseline path: ${relativePath}`);
  }
}

const decisionsDirectory = path.join(repositoryRoot, "docs/decisions");
const { readdir } = await import("node:fs/promises");
const decisionEntries = await readdir(decisionsDirectory);
for (const prefix of requiredDecisions) {
  const filePrefix = path.basename(prefix);
  if (!decisionEntries.some((entry) => entry.startsWith(filePrefix) && entry.endsWith(".md"))) {
    failures.push(`Missing required decision record with prefix: ${filePrefix}`);
  }
}

const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
if (packageJson.packageManager !== "npm@11.17.0") {
  failures.push("package.json must pin npm@11.17.0.");
}
if (packageJson.engines?.node !== ">=24.19.0 <25") {
  failures.push("package.json must restrict Node.js to the qualified 24.x baseline.");
}

if (failures.length > 0) {
  console.error("Repository baseline verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Repository and decision baseline verified.");
}
