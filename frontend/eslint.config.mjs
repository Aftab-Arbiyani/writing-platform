// ESLint 9 flat config. The shared React preset (rules, plugins, logical-property
// bans like no-ml/mr classes) lives in @qalam/config — do not add rules here.
import reactPreset from '@qalam/config/eslint/react';

export default [{ ignores: ['dist'] }, ...reactPreset];
