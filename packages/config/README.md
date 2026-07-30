# @qalam/config

Build presets for the Qalam monorepo — _how we build_, nothing else (ADR §2).

- `tsconfig/base.json` · `nest.json` · `react.json` — strict TS bases (extend via `"extends": "@qalam/config/tsconfig/base.json"`).
- `eslint/base` · `eslint/react` · `eslint/nest` — ESLint 9 flat-config presets (import in `eslint.config.mjs`).
- `prettier` — Prettier preset mirroring the root `prettier.config.mjs`.

No build step: files ship as source through the package `exports` map.
ESLint plugins are regular `dependencies` so consumers resolve them through this
package — workspaces only need a devDep on `@qalam/config` (plus `eslint` itself).
One preset source means zero drift between backend, frontends, and packages.
