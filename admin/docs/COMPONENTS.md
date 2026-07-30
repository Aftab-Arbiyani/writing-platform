# Qalam Admin — Component Inventory

Shared, cross-feature components live in `src/components` (thin adapters over
`@qalam/ui` primitives + admin-specific composites). Feature-specific components
live under `src/features/<feature>/components`. Shared hooks live in `src/hooks`.

## Shared components (`src/components`)

| Group                | Components                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout/chrome**    | `app-header`, `app-sidebar`, `app-footer`, `app-breadcrumbs`, `user-menu`, `theme-toggle`, `nav-config`, `env-badge`                                    |
| **Page scaffold**    | `page-container`, `page-header`, `widget-container`                                                                                                     |
| **Data / tables**    | `data-table` (sortable, density, selection, `virtual`-capable), `pagination`, `toolbar`, `filter-bar`, `search-input`, `bulk-action-bar`, `action-menu` |
| **Cards / tiles**    | `stat-card`, `metric-card`, `dashboard-card`, `dashboard-grid`, `quick-action-card`, `health-status-card`                                               |
| **Feedback / state** | `loading-state`, `empty-state`, `alert-panel`, `status-badge`, `status-indicator`, `activity-timeline`                                                  |
| **Overlays**         | `modal` (→`QDialog`), `drawer` (→`QDrawer`), `confirmation-dialog`                                                                                      |
| **Access control**   | `role-guard`, `permission-guard`, `access-denied`                                                                                                       |

## Shared hooks (`src/hooks`)

`use-admin-table` (URL-driven page/filters/sort/selection), `use-pagination`,
`use-filters`, `use-bulk-selection`, `use-permissions` (RBAC/PBAC), `use-me`,
`use-page-title`, `use-debounced-search`.

## Feature components (by feature)

| Feature        | Notable components                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **auth**       | `login-form`, `session-expired-dialog`                                                                                                                                                                       |
| **dashboard**  | `overview-widget`, `system-health-widget`, `moderation-widget`, `activity-widget`, `alerts-widget`, `quick-actions-widget`, `time-range-filter`                                                              |
| **users**      | table columns, `users-toolbar`, `user-detail-drawer`, `edit-user-modal`, `user-bulk-bar`, `export-menu`, `column-visibility-menu`, `saved-filters-menu`, row actions                                         |
| **moderation** | reports table/columns, `reports-toolbar`, `report-detail-drawer`, `decision-dialog`, `assign-dialog`, `report-bulk-bar`, `report-statistics`, `report-timeline`, appeals views, badges                       |
| **audit**      | audit columns, `audit-toolbar`, `audit-filters`, `audit-detail-drawer`, `audit-statistics`, `audit-timeline`                                                                                                 |
| **settings**   | `settings-nav`, `settings-form`, `setting-field`, `setting-group`, `configuration-card`, `save-bar`, `unsaved-changes-dialog`, `feature-flag-table`/`dialog`, `maintenance-section`/`banner`                 |
| **analytics**  | charts (`echart`, `line`/`bar`/`pie`/`heatmap`, `chart-container`), `analytics-card`, `date-range-selector`, `analytics-filter-bar`, `ranked-list`, `analytics-skeleton`, `section-state`, six section views |

## Reuse principle

`stat-card`/`metric-card`/`dashboard-grid` and the overlay/state components are the
**canonical building blocks** — features compose them rather than reinventing.
Where a feature needs a bespoke surface (chart wrappers, a settings form field),
it still delegates styling/behavior to `@qalam/ui` primitives + `--q-*` tokens.

_A9 pruned unused speculative components (`metric-badge`, `dashboard-skeleton`,
analytics `growth-badge`/`comparison-card`) to keep the inventory dead-code-free;
the live trend indicator is `metric-card`'s built-in delta._
