# 33 — Form Validation

> **Status:** Binding. **Derives from:** `00_ArchitectureDecisions.md` §6 (RHF + Zod, schemas
> shared with the API layer), `12_StateManagement.md` §4 (form state quadrant + server-error
> mapping), `05_APIStandards.md` §3–4 (envelope, `VALIDATION_FAILED` details). Forms are the
> **Form-state** quadrant (`12` §1); they never touch Zustand or query caches while in
> progress. Field components: `07` §7.2, `08` §3.1. Error copy catalogue: `06` §4.5.

---

## 1. The stack and the one rule

**React Hook Form 7 + Zod 3.24** (`@hookform/resolvers/zod`). Every form of more than one
field is RHF; hand-rolled `useState` forms are banned (`16` §4.4).

> **Zod is pinned at 3.24** — v4 is blocked by the `@hookform/resolvers` peer range (ADR §6
> version pins). Write v3 schemas; migrate when the resolver supports v4.

**The rule:** the schema is the single client-side source of validation truth, and it is
**built from `@qalam/shared` primitives** so the frontend and backend cannot drift (ADR §6).
Request _types_ come from `@qalam/api-types` (generated from OpenAPI); the Zod _rules_ reuse
the same `@qalam/shared` constants both sides import (`USERNAME_REGEX`, `PASSWORD_MIN`,
`TITLE_MAX`, `TAGS_MAX_PER_PIECE`, …). One vocabulary, two enforcers.

---

## 2. Where schemas live

**Colocated with the form, inside the feature** (`12` §4):

```
features/auth/schemas/register.schema.ts      # imports USERNAME_REGEX, PASSWORD_MIN from @qalam/shared
features/editor/schemas/publish.schema.ts
features/settings/schemas/profile.schema.ts
```

The component imports its schema; the schema imports domain atoms from `@qalam/shared`. A
schema is never defined inline in a component, and never duplicated across features (if two
forms share a shape, the shared atom lives in `@qalam/shared`, not a copied Zod object).

```ts
// features/auth/schemas/register.schema.ts
import { z } from 'zod';
import { USERNAME_REGEX, PASSWORD_MIN, PASSWORD_MAX, PEN_NAME_MAX } from '@qalam/shared';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().regex(USERNAME_REGEX), // ^[a-z0-9_]{3,30}$ — the SAME regex the API uses
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX), // 10..128
  penName: z.string().min(1).max(PEN_NAME_MAX), // 1..50
});
export type RegisterInput = z.infer<typeof registerSchema>;
```

**Mirror the backend's real limits** (from `@qalam/shared/limits`, do not invent):
`PASSWORD 10..128`, `USERNAME 3..30` (`^[a-z0-9_]{3,30}$`), `PEN_NAME 1..50`, `BIO ≤500`,
`LOCATION ≤100`, `WEBSITE_URL ≤255`, `TITLE ≤200`, `SUBTITLE ≤300`, `FEATURED_QUOTE ≤280`
(validate at **280** though the DB column is 500), `TAGS ≤5/piece`, `COMMENT 1..2000`,
`COLLECTION_NAME 1..150`, `COLLECTION_DESCRIPTION ≤500`.

---

## 3. The `useForm` contract

```ts
const form = useForm<RegisterInput>({
  resolver: zodResolver(registerSchema),
  mode: 'onTouched', // validate on blur first, then on change after the first error — calm, not naggy
  defaultValues: { email: '', username: '', password: '', penName: '' },
});
```

- **`mode: 'onTouched'`** everywhere (`12` §4): no error appears until a field is blurred; once
  a field has errored it re-validates on change. Never `mode: 'onChange'` (naggy) or
  `'onSubmit'`-only (surprises at the end).
- **Always provide `defaultValues`** for every field (controlled from first render; avoids
  uncontrolled→controlled warnings).
- **Enum/select fields** use the `@qalam/shared` enum as the Zod enum (`z.nativeEnum(Visibility)`)
  so the option list and the validator share one source.

---

## 4. Server-error mapping (the envelope → RHF)

The API returns field-level detail on `VALIDATION_FAILED` (400) and domain codes on 422. Map
them into RHF with **one shared helper** (`12` §4):

```ts
// lib/forms/apply-server-errors.ts
export function applyServerErrors<T extends FieldValues>(
  err: ApiError,
  form: UseFormReturn<T>,
): void {
  for (const d of (err.details ?? []) as ValidationDetail[]) {
    // d.field uses dot/bracket paths: "profile.penName", "tags[5]" (05 §4)
    form.setError(d.field as Path<T>, { type: 'server', message: messageFor(err.code, d) });
  }
  if (!err.details?.length) {
    // code-only errors (no field) → form-level banner via errors.root.server
    form.setError('root.server', { message: messageFor(err.code) });
  }
}
```

Rules:

- **Field errors land inline** (username taken → under the username field). **Code-only errors
  render as a form-level banner** via `errors.root.server` (`AUTH_INVALID_CREDENTIALS` →
  _"That email and password don't match."_).
- **Copy is keyed by `error.code`**, client-side, from `lib/error-messages.ts` — server
  messages are for developers (`05` §3, `06` §4.5). `d.rule` (the class-validator constraint
  name, e.g. `isEmail`, `matches`, `arrayMaxSize`) is available for finer copy when needed.
- **Real domain codes to map per form** (from the frozen surface):
  - Register: `AUTH_EMAIL_TAKEN` (409) → email field; `AUTH_USERNAME_TAKEN` (409) → username
    field; `VALIDATION_FAILED` (400) → `details`. _(No live username-availability endpoint
    exists — `11` §10.4 — so "taken" surfaces on submit.)_
  - Login: `AUTH_INVALID_CREDENTIALS` (401), `AUTH_ACCOUNT_SUSPENDED` (403) → root banner.
  - Password: `AUTH_CURRENT_PASSWORD_INVALID`, `AUTH_PASSWORD_WEAK`, `AUTH_RESET_INVALID`.
  - Publish/schedule: `PIECE_SCHEDULE_IN_PAST` (422) → the schedule field
    (_"That time has already passed."_); `PIECE_INCOMPLETE` (422) → summary of missing
    required fields (title, genre, language); `PIECE_ALREADY_PUBLISHED` (409),
    `PIECE_TAG_LIMIT_EXCEEDED`, `PIECE_CONTENT_INVALID`.
  - Profile: `USER_USERNAME_IMMUTABLE` (422 — never even offer a username edit), `LANGUAGE_INVALID`,
    `GENRE_INVALID`.
  - Collections: `COLLECTION_NAME_TAKEN`, `COLLECTION_DEFAULT_IMMUTABLE`.
- **`VALIDATION_FAILED` should be rare** — the Zod schema mirrors the backend, so most invalid
  input is caught client-side before submit. When it _does_ fire, `applyServerErrors` still
  places it correctly (defense in depth; never assume the client caught everything).

---

## 5. Reusable field components

Fields wrap the `@qalam/ui` primitives (`08` §3.1) and bind to RHF via `Controller` (or
`register` for native inputs). Build a thin **feature-agnostic field set** (in `components/`
or `@qalam/ui` if used by both apps) so every form looks and behaves identically:

| Field               | Wraps                  | Binds                   | Notes                                                                       |
| ------------------- | ---------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `FormInput`         | `QInput`               | `register`/`Controller` | wires `error`, `hint`, `aria-invalid`, `aria-describedby` from `fieldState` |
| `FormTextArea`      | `QTextArea`            | `Controller`            | `showCount` against the shared limit; `dir="auto"` for user content         |
| `FormSelect`        | `QSelect`              | `Controller`            | options from a `@qalam/shared` enum                                         |
| `FormPasswordInput` | `QInput type=password` | `register`              | strength meter = quiet 3-segment line, no red/green bars (`06` §3.7)        |
| `FormTagInput`      | `QTag` set             | `Controller`            | ≤5 tags (`TAGS_MAX_PER_PIECE`); removable tags carry `aria-label`           |
| `FormError` (root)  | —                      | `errors.root.server`    | form-level banner                                                           |

Contract for each: label (14px/500), field, then `hint | error` (12px); on error → border
`--q-danger`, message in `danger-text` with a 16px alert icon, `aria-invalid` +
`aria-describedby` pointing at the message id (`07` §7.2, §13). **No floating labels** — they
misbehave in RTL + Nastaliq; labels are static. User-content fields default `dir="auto"` so an
Urdu title right-aligns as typed.

---

## 6. Validation messages

- **Copy is keyed by code/rule, not hardcoded per field**, and lives in the same catalogue as
  error copy — one voice, one place (`06` §4.5, §10.3). Messages are short, warm,
  non-exclamatory, and never blame the user.
- **Announce, don't shout:** the message region is `aria-live="polite"` (or wired via
  `aria-describedby`); on submit-with-errors, focus moves to the **first invalid field**
  (`form.setFocus`) and the field scrolls into view (`07` §13).
- **Localization-ready:** because messages resolve from `code`/`rule` (not inline strings),
  swapping to `react-i18next` later is a catalogue change, not a form rewrite. Phase 1 copy is
  English.

---

## 7. Submission strategy

```ts
const mutation = usePublishPiece(); // TanStack Query mutation (12 §2.4)
const onSubmit = form.handleSubmit(async (values) => {
  try {
    await mutation.mutateAsync(values);
    // success handled by the mutation's onSuccess (navigate/toast/invalidate) — 06 §10.1
  } catch (err) {
    if (err instanceof ApiError) applyServerErrors(err, form);
    else form.setError('root.server', { message: messageFor('API_UNEXPECTED_ERROR') });
  }
});
```

Rules:

- **The submit is a TanStack Query mutation** (`12`), so success invalidation/optimism/
  navigation all live in the mutation hook — the form only maps errors back. Forms **never
  touch Zustand or query caches while in progress** (`12` §4).
- **Disable submit while `isSubmitting`/`isPending`**; the primary button shows its `loading`
  state (spinner replaces the start icon, width locked, `aria-busy`) — never a spinner on the
  form body (`07` §7.1).
- **Publish/schedule/delete are never optimistic** and carry a pending state; publish sends a
  per-intent **`Idempotency-Key`** so a double-click can't double-publish (`32` §8).
- **Wizard forms (register)** use **one RHF instance across steps**, with per-step `trigger()`
  gating advancement; the final submit fires **once, atomically** (`12` §4, `06` §3.7). The
  username step's confirm dialog (_"Write it in ink?"_) is the one deliberate confirm in
  onboarding — permanence is a product invariant.
- **Auto-save forms are a different pattern:** the editor is not an RHF form — TipTap owns the
  document and autosave is a debounced mutation (`12` §5), not `handleSubmit`. Settings
  "toggle" controls save on interaction; a dirty settings form shows a sticky Save bar
  (`06` §3.8).

---

## 8. Checklist (per form)

```
□ RHF + zodResolver; mode 'onTouched'; defaultValues for every field
□ Schema in features/<name>/schemas/, built from @qalam/shared atoms (real limits/regex)
□ Enum fields use @qalam/shared enums for both options and validation
□ Server errors mapped via applyServerErrors: field details → inline, code-only → root banner
□ Copy keyed by error.code/rule from the catalogue — never hardcoded, never server .message
□ Fields wrap @qalam/ui primitives; static labels; aria-invalid + aria-describedby; dir="auto" for user content
□ Submit is a TanStack mutation; button loading; disabled while pending; publish carries Idempotency-Key
□ Publish/schedule/delete not optimistic; wizard = one instance, per-step trigger, atomic submit
□ On invalid submit: focus first invalid field; message region aria-live polite
```
