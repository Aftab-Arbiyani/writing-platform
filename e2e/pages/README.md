# E2E Page Objects

Page objects wrap one screen/region and hide all locators (docs/e2e/02 §2). Specs
never contain selectors — they compose these classes.

```
pages/
  shared/    login-page.ts        # both apps (Email/Password/"Sign in")
             antd.ts              # selectAntdOption — keyboard-driven AntD Select (virtualized-safe)
  frontend/  app-nav.ts           # top-bar account menu + logout marker
             editor-page.ts       # writing + publish drawer (TipTap) + autosave/reload/edit
             drafts-page.ts       # writer dashboard: status tabs, per-row Edit
             feed-page.ts         # Latest feed: load, infinite-scroll paginate, open, visible/absent
             search-palette.ts    # command palette: open, type, piece suggestion → /p/:slug
             profile-page.ts      # own/other profile, edit link, follow
             settings-page.ts     # Edit profile + change password
             notifications-page.ts# in-app inbox (reload-retry for post-commit events)
  admin/     users-page.ts        # AntD users table: search, suspend, view, change role
             moderation-page.ts   # /reports queue: resolve (DecisionDialog)
             audit-page.ts        # /audit-logs: search + assert action code
```

## data-testid inventory (docs/e2e/05 §3.4)

Selector priority is role → label/text → `data-testid`. We add test ids only where
roles/labels can't disambiguate; every one is tracked here.

| testid                | App   | Element                      | Why (why role/label was insufficient)                                                                                                                                                                                  |
| --------------------- | ----- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-header`        | admin | Authenticated console header | Pre-existing in app source; the reliable logged-in marker for admin.                                                                                                                                                   |
| `user-detail-drawer`  | admin | Users → detail drawer body   | AntD Drawer title/Descriptions render as plain text with no accessible name; scoping the body disambiguates the user's email vs. the same email in the table behind the drawer.                                        |
| `report-actions-<id>` | admin | Reports → row action button  | The button's aria-label is only an 8-char id prefix, which collides across time-ordered (UUIDv7) report ids created close together; the full-id testid targets a specific row. Added via `ActionMenu`'s `testId` prop. |

### Accessibility fixes made instead of a testid (docs/e2e/05 §3.2)

Preferred over a testid — these fix a real a11y gap and give the test a role-based hook:

| Change                                  | App   | Element                            | Why                                                                                                                                                                                |
| --------------------------------------- | ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-label="Role"` on the `Select`     | admin | Users → Edit-user modal, Role      | The AntD `Select` had no accessible name (only a wrapping visual label), so `getByRole('combobox', { name: 'Role' })` couldn't target it — and neither could a screen-reader user. |
| `aria-label="Decision"` on the `Select` | admin | Reports → DecisionDialog, Decision | Same gap: the resolve dialog's Decision `Select` had no accessible name, so the resolution couldn't be selected by role — nor announced to a screen reader.                        |

> As specs expand, add rows here **in the same PR** that introduces the id, and note
> the page object that depends on it. A growing list is a signal to improve roles/aria
> instead (docs/e2e/05 §3.2).
