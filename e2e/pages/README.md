# E2E Page Objects

Page objects wrap one screen/region and hide all locators (docs/e2e/02 §2). Specs
never contain selectors — they compose these classes.

```
pages/
  shared/    login-page.ts        # both apps (Email/Password/"Sign in")
  frontend/  app-nav.ts           # top-bar account menu + logout marker
             editor-page.ts       # writing + publish drawer (TipTap) + autosave/reload
             feed-page.ts         # Latest feed: load, infinite-scroll paginate, open
  admin/     users-page.ts        # AntD users table: search, suspend, view, change role
```

## data-testid inventory (docs/e2e/05 §3.4)

Selector priority is role → label/text → `data-testid`. We add test ids only where
roles/labels can't disambiguate; every one is tracked here.

| testid               | App   | Element                      | Why (why role/label was insufficient)                                                                                                                                           |
| -------------------- | ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-header`       | admin | Authenticated console header | Pre-existing in app source; the reliable logged-in marker for admin.                                                                                                            |
| `user-detail-drawer` | admin | Users → detail drawer body   | AntD Drawer title/Descriptions render as plain text with no accessible name; scoping the body disambiguates the user's email vs. the same email in the table behind the drawer. |

### Accessibility fixes made instead of a testid (docs/e2e/05 §3.2)

Preferred over a testid — these fix a real a11y gap and give the test a role-based hook:

| Change                              | App   | Element                       | Why                                                                                                                                                                                |
| ----------------------------------- | ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-label="Role"` on the `Select` | admin | Users → Edit-user modal, Role | The AntD `Select` had no accessible name (only a wrapping visual label), so `getByRole('combobox', { name: 'Role' })` couldn't target it — and neither could a screen-reader user. |

> As specs expand, add rows here **in the same PR** that introduces the id, and note
> the page object that depends on it. A growing list is a signal to improve roles/aria
> instead (docs/e2e/05 §3.2).
