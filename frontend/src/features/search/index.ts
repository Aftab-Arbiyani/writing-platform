/**
 * Public surface of the search feature (docs/26 §4) — the Search & Discovery screens (lazy route
 * modules), the ⌘K/Ctrl+K universal Command Palette (mounted once in the app shell), and its
 * top-bar trigger. Search + discovery state lives in this feature's TanStack Query hooks + its own
 * Zustand UI store; the feature is self-contained and deletable with one `rm -rf`.
 */
export { SearchPage } from './pages/search-page';
export { DiscoverPage } from './pages/discover-page';
export { CommandPalette } from './components/command-palette';
export { CommandTrigger } from './components/command-trigger';
