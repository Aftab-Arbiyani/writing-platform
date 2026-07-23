# E2E Page Objects

Page objects wrap one screen/region and hide all locators (docs/e2e/02 §2). Specs
never contain selectors — they compose these classes.

```
pages/
  shared/    login-page.ts        # both apps (Email/Password/"Sign in")
  frontend/  app-nav.ts           # top-bar account menu + logout marker
             editor-page.ts       # writing + publish drawer (TipTap)
  admin/     users-page.ts        # AntD users table + row actions
```

## data-testid inventory (docs/e2e/05 §3.4)

Selector priority is role → label/text → `data-testid`. We add test ids only where
roles/labels can't disambiguate; every one is tracked here.

| testid         | App   | Element                      | Why (why role/label was insufficient)                                |
| -------------- | ----- | ---------------------------- | -------------------------------------------------------------------- |
| `admin-header` | admin | Authenticated console header | Pre-existing in app source; the reliable logged-in marker for admin. |

> No `data-testid` exists in the frontend app yet — everything is selected by role,
> label, or text. As specs expand, add rows here **in the same PR** that introduces
> the id, and note the page object that depends on it. A growing list is a signal to
> improve roles/aria instead (docs/e2e/05 §3.2).
