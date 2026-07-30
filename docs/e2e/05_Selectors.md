# E2E 05 — Selector Strategy

> **Status:** Binding. Selectors are the single biggest source of E2E flakiness and maintenance cost.
> This document sets the **selector priority order**, the bounded **`data-testid` policy** (the second —
> and only other — substantive app-source change), and the concrete recipes for the two tricky UI
> libraries in this codebase: **AntD** (both apps) and **TipTap/ProseMirror** (frontend editor).

---

## 1. Selector priority — use the highest one that works

Always prefer selectors that mirror how a **user** perceives the element, and that are **resilient** to
markup refactors. In strict priority order:

1. **Role + accessible name** — `getByRole('button', { name: 'Publish' })`. First choice, always.
2. **Label / placeholder / text** — `getByLabel('Title')`, `getByPlaceholder('Search…')`,
   `getByText('Published')`.
3. **`data-testid`** — `getByTestId('moderation-approve')`. Only when 1–2 are ambiguous or absent (§3).
4. **CSS/XPath** — **banned** in specs and page objects, except the two documented library escapes
   (ProseMirror root, §4). Any other CSS use needs a reviewer-approved comment explaining why 1–3 failed.

**Why this order:** role/label selectors double as an **accessibility assertion** — if a button has no
accessible name, the test _can't find it_, which is exactly the a11y bug we want surfaced. `data-testid`
is stable but invisible to users, so it's a fallback, not a default. CSS couples the test to styling.

---

## 2. Rules

- **MUST** resolve to exactly one element. Use scoping (`within` a card/row, `getByRole('row', { name })`)
  rather than `.first()`. `.first()`/`.nth()` are smells — allowed only where the DOM genuinely has an
  ordered list and you want a specific ordinal, with a comment.
- **MUST** put every selector in a page object ([02 §2](./02_Conventions.md)) — never inline in a spec.
- **SHOULD** select by the user-facing name even when a testid exists, if the name is stable — it's the
  more meaningful assertion.
- **MUST NOT** select by generated/utility class names (`.ant-btn`, `.css-1x2y3z`, Tailwind classes).
  They change on library/version bumps and carry no semantic meaning.

---

## 3. The `data-testid` policy (bounded app-source change)

We add `data-testid` **only where roles/labels can't disambiguate** — primarily AntD tables, modals,
menu items, and dashboard tiles where many similar elements share roles and names. This is a **small,
reviewable, additive** change to app components (no behavior change), the analog of the "handful of
testids" in the original plan.

### 3.1 When a testid is justified

- Multiple same-role elements with the **same or no accessible name** (table action buttons per row).
- Elements with **no natural role/label** (a status chip, a stat tile value, an icon-only control).
- **Containers** used for scoping (`data-testid="user-row"` on each `<tr>` so we can scope within it).
- Elements whose visible text is **dynamic/localized** and unstable as a selector.

### 3.2 When a testid is NOT allowed

- The element already has a stable role + accessible name → use that.
- To paper over a **missing accessible name** on an interactive control → **fix the a11y** (add the
  label/aria) instead; that helps users _and_ the test. **Why:** a testid on a nameless button hides an
  accessibility defect.

### 3.3 Naming convention

`data-testid="<area>-<element>[-<qualifier>]"`, kebab-case, stable, semantic:
`moderation-approve`, `user-row`, `dashboard-tile-active-users`, `editor-publish`.

### 3.4 Governance

- Testids are added in **app PRs alongside the spec that needs them**, listed in the PR description so
  they're reviewed as a set.
- Keep a running inventory in `e2e/pages/README.md` (testid → where → why) so we can audit growth. A
  ballooning testid list is a signal our a11y/roles are weak — treat it as tech-debt, not the norm.
- **Ownership:** an app component's testid is part of its contract; removing/renaming one is a breaking
  change to E2E and must update the corresponding page object in the same PR.

---

## 4. TipTap / ProseMirror (frontend editor) — the special case

The writing editor is TipTap (ProseMirror). It is **not** a plain `<textarea>`; it's a
`contenteditable` `<div class="ProseMirror">`. Consequences:

- **Root selector:** prefer an accessible name — the editor should expose
  `role="textbox"` + an `aria-label` (e.g. "Story body"); target `getByRole('textbox', { name: 'Story body' })`.
  If the app doesn't yet, add the aria (preferred) or fall back to a single documented CSS escape
  `page.locator('.ProseMirror')` — **the one sanctioned CSS selector**, wrapped in the `EditorPage` PO.
- **Typing:** `.fill()` does **not** reliably work on contenteditable. Use `.click()` then
  `.pressSequentially('text')` (real key events) so ProseMirror's input rules fire. For speed on long
  bodies, `.fill()` may work for the plain-text case — verify per engine; default to `pressSequentially`.
- **Formatting/toolbar:** toolbar buttons are normal AntD buttons — select by role+name
  (`getByRole('button', { name: 'Bold' })`) or keyboard shortcut (`page.keyboard.press('Control+b')`).
- **Assertions:** assert on rendered output (`await expect(editorBody).toContainText('Hello')`), not on
  ProseMirror internal JSON.

**Why call this out:** contenteditable is the #1 place naive E2E breaks (silent no-op `.fill()`), and it
differs subtly across the three engines — WebKit handles key events and selection differently. Centralize
all of it in `EditorPage` so the quirks live in one file.

---

## 5. AntD (both apps) — recipes

AntD renders semantic roles for most components, so role/label usually works — but a few patterns need care:

| AntD component                   | Recipe                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**                       | `getByRole('button', { name })`. Icon-only buttons need an `aria-label` (add it) or a testid.                                                                                                         |
| **Input / Form.Item**            | `getByLabel('Title')` — AntD wires the label via `htmlFor` when `Form.Item` has a `label`. If not, add `aria-label` or testid.                                                                        |
| **Table**                        | Rows are `getByRole('row', { name })` when the row has distinguishing text; otherwise put `data-testid="…-row"` on the row and scope with `within`. Action buttons per row → testid (`user-suspend`). |
| **Modal / Dialog**               | `getByRole('dialog')`, then scope: `dialog.getByRole('button', { name: 'Confirm' })`. **Why scope:** the trigger button and the modal's confirm button often share a name.                            |
| **Select / Dropdown**            | `getByRole('combobox')` → open → `getByRole('option', { name })`. AntD renders options in a portal at `<body>` end — role selectors handle the portal; CSS often won't.                               |
| **Menu (nav)**                   | `getByRole('menuitem', { name })`, or `getByRole('link', { name })` for router links.                                                                                                                 |
| **Message/Notification (toast)** | `getByText('Saved')` / `getByRole('alert')`. These auto-dismiss — assert _presence_, don't depend on them lingering.                                                                                  |
| **Tabs**                         | `getByRole('tab', { name })`.                                                                                                                                                                         |
| **Popconfirm**                   | Click trigger → the confirm popup is a small dialog; scope to its "OK" (`getByRole('button', { name: 'OK' })`).                                                                                       |

**Portals note:** AntD renders modals, dropdowns, tooltips, and popconfirms into portals at the end of
`<body>`, not inline. Role/text selectors find them anywhere in the DOM; **CSS scoped to a parent will
miss them** — another reason role selectors win.

---

## 6. Dashboards & charts (admin)

Admin dashboards (analytics/operations/security/system) use **echarts**, which renders to `<canvas>` —
its contents are **not** in the DOM and **cannot** be asserted by normal selectors. Rules:

- Assert on the **surrounding DOM**: the tile label, the numeric KPI value (put it in a
  `data-testid="dashboard-tile-<metric>"` element with the number as text), the presence of the chart
  container, legend items (if rendered as DOM), and any table backing the chart.
- **Do not** try to read pixels from the canvas. If a chart's _data_ must be asserted, assert it via the
  `api` fixture (the same endpoint the chart calls) and just assert the chart _rendered_ in the UI.

**Why:** canvas is opaque to Playwright; testing "the bar is 42px tall" is both impossible and
meaningless. We assert the data path (API) and the render presence (DOM), not the pixels.

---

## 7. Quick reference

```ts
// ✅ preferred
page.getByRole('button', { name: 'Publish' });
page.getByLabel('Email');
page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
page.getByTestId('user-row').filter({ hasText: email }).getByTestId('user-suspend');

// ⚠️ sanctioned escapes (in page objects only, with a comment)
page.locator('.ProseMirror'); // TipTap contenteditable root (05 §4)

// ❌ banned
page.locator('.ant-btn-primary'); // utility/library class
page.locator('div > div:nth-child(3) span'); // structural CSS
page.waitForTimeout(1000); // not a selector, but the sibling sin
```
