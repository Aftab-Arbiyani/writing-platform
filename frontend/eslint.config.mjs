// ESLint 9 flat config. The shared React preset (rules, plugins, logical-property
// bans like no-ml/mr classes) lives in @qalam/config — do not add rules here.
import reactPreset from '@qalam/config/eslint/react';

// `public/sw.js` is a service-worker template (worker globals, not a module); `scripts/` and
// `perf/` are Node build helpers (the P7.3 bundle-budget checker) — none belongs to the app TS
// program, so keep them out of the app lint.
export default [{ ignores: ['dist', 'public/sw.js', 'scripts', 'perf'] }, ...reactPreset];
