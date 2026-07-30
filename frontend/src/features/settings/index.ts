/**
 * Public surface of the settings feature (docs/26 §4) — the `/settings/{profile,account,
 * appearance}` sections + their shell. Imported by the lazy `settings` route module. Owns the
 * edit-profile form + media uploaders, account security, and appearance/preference controls.
 * Self-contained and deletable with one `rm -rf`.
 */
export { SettingsLayout } from './components/settings-layout';
export { EditProfilePage } from './pages/edit-profile-page';
export { AccountPage } from './pages/account-page';
export { AppearancePage } from './pages/appearance-page';
