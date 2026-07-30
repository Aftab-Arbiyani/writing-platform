// @qalam/ui now ships React primitives, so it uses the shared React preset (react-hooks
// rules + logical-property bans) rather than the plain base config.
import reactPreset from '@qalam/config/eslint/react';

export default [{ ignores: ['dist'] }, ...reactPreset];
