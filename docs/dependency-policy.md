# Dependency policy

Status: Accepted

Effective date: 23 August 2026

## Principles

1. Add a dependency only when it materially reduces product risk or maintenance cost.
2. Direct production and development dependencies use exact versions.
3. `package-lock.json` is committed and installs use `npm ci` after bootstrap.
4. Code may not import an undeclared transitive dependency.
5. Runtime and service images use exact patch tags in development and immutable digests in release deployment.
6. Unsupported/EOL runtimes are rejected by `engines` and `.npmrc`.
7. Pre-release packages require an explicit qualification record and exact pin.

## Addition checklist

Before adding a production dependency, record:

- the product capability it owns;
- why a small application-owned implementation is insufficient;
- license and redistribution implications;
- maintenance activity and security posture;
- Node.js/TypeScript/browser compatibility;
- bundle or image impact;
- removal or replacement strategy;
- tests that protect the integration boundary.

Development-only tools require a lighter review but still need compatible licenses, exact versions, and an owning script/gate.

## Version policy

- Node.js is pinned to the selected LTS patch in `.nvmrc`; `package.json` limits the accepted major line.
- npm is pinned through `packageManager` and its engine range.
- NestJS packages must stay on the same exact patch unless upstream explicitly documents otherwise.
- `prisma`, `@prisma/client`, and every Prisma driver adapter must use the same exact version.
- React and React DOM must use identical versions.
- `@lily_platform/lily_ui` stays on `0.1.0-alpha.2` until a compatibility change explicitly qualifies another release.
- Database/broker/cache minor upgrades need migration/recovery and integration-smoke review, even when upstream calls them compatible.

## Lily UI policy

- Import only documented package exports; never import from package `src`, `dist`, or implementation files.
- Prefer focused subpath imports to preserve lazy-route bundle boundaries.
- Every Lily component receives a stable `id` where required by its contract.
- Upgrades require clean install, type-check, production build, keyboard/focus, accessibility, and representative form/table/router checks.

## Supply-chain controls

- Normal CI uses `npm ci --ignore-scripts` where package lifecycle scripts are not required.
- Any package that requires install scripts must be reviewed and explicitly documented.
- npm audit findings are evaluated by reachable impact, not silently suppressed.
- Production images are built from the lockfile, scanned, run as non-root, and promoted by digest.
- Secrets and registry credentials never appear in npm config committed to the repository.

## Update cadence

- Security patches: evaluate promptly and qualify the smallest safe update.
- Runtime/framework patch review: monthly while active development continues.
- Major upgrades: separate planned work; never combine with an unrelated feature.
- Lockfile-only changes must still pass the full affected verification chain.
