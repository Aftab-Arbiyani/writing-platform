# 06 — UI/UX Specification

> **Derives from:** `00_ArchitectureDecisions.md` §6 (frontend), §7 (design tokens), §10
> (route map, product decisions). Token values referenced here (`--q-*`) are defined
> canonically in `07_DesignSystem.md`. This document specifies _behavior and layout_;
> the design system specifies _values_; the component library specifies _contracts_.

---

## 1. Design Philosophy

Qalam is **a premium writing sanctuary** — warm paper and ink, not a content feed with a
text box bolted on. Every screen is judged by one question: _does this make the writing
feel more important, or less?_

The product serves two postures that must never bleed into each other:

- **Reading** — the interface disappears. Chrome recedes, typography carries everything.
- **Everything else** (feed, search, settings, analytics) — calm utility. Quiet, dense
  enough to be useful, never louder than the writing it points to.

### 1.1 UX Principles

| #   | Principle                        | What it means in practice                                                                                                                                                                          |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Writing is the hero**          | Body text gets the largest, most refined type on any screen. No UI element on a reading page may exceed the visual weight of the prose. Covers and avatars support; they never dominate.           |
| 2   | **Whitespace is a feature**      | Generous margins are not wasted space — they are the sanctuary. Density is a last resort, allowed only in admin tables and analytics. Minimum 48px between major sections on desktop, 32px mobile. |
| 3   | **Chrome recedes while reading** | Top bar and action rail fade to 0 opacity after 2s of downward scroll; any upward scroll or pointer movement toward an edge restores them in 150ms. Nothing sticky overlaps the text column, ever. |
| 4   | **Never make the writer wait**   | Autosave is continuous and ambient. Publishing is optimistic where safe. Skeletons appear within 100ms; spinners are banned on content surfaces.                                                   |
| 5   | **Undo over confirm**            | Reversible actions execute immediately with a 5s undo toast. Confirmation dialogs are reserved for the irreversible (delete published piece, delete account, change nothing else warrants one).    |
| 6   | **Two scripts, one dignity**     | Urdu (RTL, Nastaliq) is a first-class citizen, not a mirrored afterthought. Layouts are built in logical properties from the first line of CSS; Nastaliq gets the vertical room it demands.        |
| 7   | **Quiet numbers**                | Stats (claps, views) render in `--q-text-secondary` at small sizes. Metrics inform; they never gamify. No red badges screaming for attention — notification dots use `--q-accent`.                 |
| 8   | **Literary voice everywhere**    | Empty states, errors, and confirmations read like they were written by an editor, not a framework. Copy is short, warm, and never exclamatory.                                                     |

---

## 2. Global Shell

Desktop (≥1024px): fixed top bar, 64px, `--q-bg-canvas` with 1px `--q-border` bottom;
content max-width 1280px centered. Mobile (<768px): top bar 56px + bottom tab bar 56px
(+ safe-area inset) with five destinations: **Feed · Search · Write · Notifications · Profile**.
The Write tab is visually accented (`--q-accent` icon) — writing is the primary CTA of the
entire product.

```
Desktop top bar
┌──────────────────────────────────────────────────────────────────────────┐
│ Qalam        [ Search writers, pieces, tags…          ]   [Write] (bell)(avatar) │
└──────────────────────────────────────────────────────────────────────────┘
   logo=text wordmark, 20px reading serif · search = 480px max · Write = primary QButton
```

Keyboard: `/` focuses search, `c` opens `/write`, `g f` goes to feed. All shell landmarks:
`<header>`, `<nav>`, `<main>`, skip-link as first tab stop ("Skip to content").

---

## 3. Screens

### 3.1 Feed — `/feed?tab=following|trending|latest|discover`

Tab lives in the URL (React Router search param) — back button and sharing work.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Following    Trending    Latest    Discover                             │
│  ─────────                                       ← active: 2px --q-accent│
├───────────────────────────────────────────┬──────────────────────────────┤
│ ┌───────────────────────────────────────┐ │  Today's prompt              │
│ │ (avatar) Pen Name · @username · 2d    │ │  "Write about a door you     │
│ │                                       │ │   never opened."   [Write →] │
│ │ Piece Title — 25px reading serif      │ ├──────────────────────────────┤
│ │ Subtitle or excerpt, two lines max,   │ │  Writers to follow           │
│ │ 16px, --q-text-secondary…             │ │  (avatar) Name    [Follow]   │
│ │                                       │ │  (avatar) Name    [Follow]   │
│ │ [ghazal] [اردو]   6 min · [clap 1.2k] │ ├──────────────────────────────┤
│ │            [like 214] [save] [more]   │ │  Trending tags               │
│ └───────────────────────────────────────┘ │  [nazm] [कविता] [monsoon]    │
│ ┌── next PieceCard ─────────────────────┐ │                              │
└──────────────────────────────────────────┴──────────────────────────────┘
  main column 680px · sidebar 320px, hidden <1024px · cards on --q-bg-surface
```

| Tab       | Ordering                            | Notes                                                                                                                          |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Following | Reverse-chron from followed writers | Cursor pagination. "New pieces" pill (fade-rise, top center) when newer items exist; click prepends, never auto-shifts scroll. |
| Trending  | `trending-score` job output         | Score window shown subtly ("Trending this week").                                                                              |
| Latest    | Reverse-chron, all public           | Language filter chips persist in URL (`&lang=ur`).                                                                             |
| Discover  | Genre/tag/language exploration      | Editorial: featured writers row + genre shelves; the only feed tab allowed horizontal scrollers.                               |

**PieceCard behavior:** whole card is one link (`/p/:slug`); action buttons are separate
focus stops layered above (nested interactive pattern: card link is a pseudo-element).
Cards carrying Urdu titles render that _card's_ text `dir="rtl"` in Nastaliq — the card
grid itself does not flip.

**Mobile:** single column, cards edge-to-edge with 16px inline padding; tabs become a
swipeable, horizontally scrollable bar pinned under the top bar; sidebar content moves
into Discover.

### 3.2 Reading View — `/p/:slug` (the crown jewel)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ 2px reading progress, --q-accent, fills from   │
│                            the piece's inline-start (RTL for Urdu)       │
│  Qalam                                    (chrome fades after 2s scroll) │
│                                                                          │
│            ┌────────────── 68ch column, centered ──────────────┐         │
│            │  [cover image, optional, radius 10, 2:1 max]      │         │
│  ┌────┐    │                                                   │         │
│  │clap│    │  Title — 39px reading serif, lh 1.3               │         │
│  │1.2k│    │  Subtitle — 20px, --q-text-secondary              │         │
│  │    │    │  (avatar) Pen Name · @user · 6 min read  [Follow] │         │
│  │like│    │  ───────────────────────────────────────────      │         │
│  │    │    │  Body — 20px Lora / Noto Serif Devanagari,        │         │
│  │save│    │  lh 1.7 · Urdu: 22px Noto Nastaliq, lh 2.1        │         │
│  │    │    │                                                   │         │
│  │shre│    │  A featured quote renders as a pull block¹ …      │         │
│  └────┘    │                                                   │         │
│  sticky    │  ¹ footnote: inline ref superscript --q-accent    │         │
│  rail      └───────────────────────────────────────────────────┘         │
│            ── end of piece ──────────────────────────────────────        │
│            [tags] [genre] [language]                                     │
│            Clap · Like · Save · Share · Repost · Quote · Respond         │
│            ┌ Responses (pieces written in response) ┐                    │
│            │ PieceCard (compact) …                  │                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Column:** 65–72ch; we fix at **68ch** (`max-width: 68ch` on the body element so `ch`
tracks the active reading font). Background is `--q-bg-canvas` — no card, the page _is_
the paper.

**Progress:** top bar, 2px, `--q-accent`, `role="progressbar"` with throttled
`aria-valuenow` (updates each 10%). Represents position in the text, so it fills in the
piece's reading direction (see §6).

**Action rail:** sticky at the column's inline-start margin, vertically centered; icons
20px lucide with counts beneath in 12px `--q-text-secondary`. Contains: ClapButton
(hold-or-tap, 1–50 claps, count animates per tap, batch-sent after 600ms idle), Like
(toggle), Bookmark (toggle; long-press/right-click opens "Save to collection…" QDialog),
Share (native share sheet / copy link), Overflow (repost, quote, report). On mobile the
rail becomes a bottom action bar, 56px, `--q-bg-surface`, top border, which hides on
scroll-down and returns on scroll-up.

**Footnotes:** superscript refs in `--q-accent`; tap opens an inline expansion directly
under the current paragraph (not a jump) with a fade-rise 250ms; the footnote list also
renders at piece end. Desktop hover shows a popover after 300ms.

**Responses:** pieces written in response (`responses` table, piece→piece) render as
compact PieceCards below the piece, with a "Write a response" primary action that opens
`/write?respondTo=:slug`.

**Reader settings** (gear in faded chrome): reading size S/M/L (18/20/22px Latin —
Nastaliq maps to 20/22/24), theme override for this device. Persisted in the Zustand
theme slice.

### 3.3 Editor — `/write`, `/write/:draftId`

Distraction-free. No sidebar, no nav tabs, no counters until requested.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Drafts                     Saved just now ·         [Preview] [Publish]│
│                                                                          │
│              Title (placeholder, 39px reading serif)                     │
│                                                                          │
│              Tell your story…  (20px reading serif, 68ch)                │
│                                                                          │
│                  ┌─────────────────────────────────────┐                 │
│                  │ B  I  U │ ⟨align⟩ │ " │ • 1. │ ¹ @ # │ ← floating     │
│                  └─────────────────────────────────────┘   on selection  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Marks (locked by ADR):** bold, italic, underline, alignment, blockquote, ordered +
  unordered lists, footnotes, mentions (`@` → user search popover), hashtags (`#` →
  tag popover). Nothing else in Phase 1. TipTap 3, custom extensions for the last three.
- **Floating toolbar:** appears above selection (below on mobile, pinned above the
  keyboard); 40px tall; roving tabindex; `Esc` returns focus to text. In Urdu drafts the
  italic button is disabled with tooltip "Italic isn't available in Nastaliq" (§7).
- **Autosave:** debounced 1.5s after last keystroke + every 30s + on blur. Indicator in
  the top bar cycles `Saving… → Saved just now → Saved 2m ago`; failures show
  `Couldn't save — retrying` in `--q-warning-text` with automatic retry and a persistent
  local copy (IndexedDB) so nothing is ever lost. Indicator is `aria-live="polite"`.
- **Language:** chosen per piece (one language per piece — ADR). Selecting Urdu flips
  the editing surface to `dir="rtl"` + Nastaliq immediately; alignment buttons operate
  on logical start/end.
- **Word count / reading time:** hidden by default; toggle in the `⋯` menu, renders
  bottom corner in 12px muted-on-large exception (14px `--q-text-secondary`).

**Mobile:** title and body identical; toolbar docks above the virtual keyboard as a
horizontally scrollable strip; Preview/Publish collapse into a single `Next` button.

### 3.4 Publish Flow — draft → preview → publish sheet

```
[Editor] ──Preview──▶ [Full-page preview: exactly the reading view, banner:
                       "Previewing — readers will see this"  [Back] [Publish]]
                                        │ Publish
                                        ▼
┌── Publish ─────────────────────────────────── ✕ ──┐
│ Cover        [ + Add cover ]  (optional, 2:1 crop) │
│ Title*       [ prefilled from draft            ]   │
│ Subtitle     [                                 ]   │
│ Featured quote  [ Select from text ▾ ]             │  ← picks a sentence; renders
│ Language*    [ اردو Urdu ▾ ]                       │    as pull-quote + share card
│ Genre*       [ Ghazal ▾ ]                          │
│ Tags (≤5)    [nazm ×] [شام ×] [ + tag ]            │
│ Visibility   (•) Public  ( ) Unlisted ( ) Private  │
│ Schedule     [ ] Publish later → [date] [time]     │
│                                                    │
│              [ Back to draft ]   [ Publish now ]   │
└────────────────────────────────────────────────────┘
```

- Desktop: right-side sheet, 480px, radius 16 on the leading edge; mobile: full-screen
  sheet. Focus-trapped, `Esc` closes back to preview.
- Validation inline on blur, summarized on submit; scheduling in the past returns
  `PIECE_SCHEDULE_IN_PAST` → field error "That time has already passed."
- Publish uses an `Idempotency-Key` (ADR §5) — double-clicks are safe.
- Success: navigate to `/p/:slug` with a one-time quiet banner "Published." and share
  affordance. Scheduled: return to `/me/drafts` with the piece in a "Scheduled" group
  showing the local-timezone time.

### 3.5 Profile — `/@:username`

```
┌──────────────────────────────────────────────────────────────────┐
│ [optional cover strip, 3:1, radius 0]                             │
│ (avatar 80px)  Pen Name (25px)          [Follow] / [Edit profile] │
│                @username · 14px --q-text-secondary (always LTR)   │
│                Bio, up to 3 lines. Location · Joined May 2026     │
│                128 pieces · 4.2k followers · 310 following        │
├───────────────────────────────────────────────────────────────────┤
│  Pieces    Collections    About                                   │
│  ──────                                                           │
│  PieceCard (author row hidden — we're on their page)…             │
└───────────────────────────────────────────────────────────────────┘
```

- **Pen name is the display name** (single, changeable); `@username` is permanent and
  always rendered LTR inside a bidi isolate, even amid RTL text.
- **Private accounts:** non-followers see avatar, pen name, username, bio, follower
  count, and a lock state: _"This writer keeps a private notebook. Follow to request
  access."_ → Follow becomes **Requested** (optimistic). Pieces/Collections tabs render
  the lock empty state, never a count tease of hidden content.
- Own profile adds an Edit profile button → `/settings/profile`, and a Drafts shortcut.

### 3.6 Search & Discovery — `/search?q=&type=&genre=&lang=`

All state in the URL. Instant results after 2 characters, debounced 300ms.

```
┌──────────────────────────────────────────────────────────┐
│ [ search: "شام"                                    ✕ ]   │
│  All   Writers   Pieces   Tags                           │
│  Filters: [Genre ▾] [Language ▾]                         │
├──────────────────────────────────────────────────────────┤
│ Writers — (avatar) Pen Name @user · 1.2k followers [Follow]
│ Pieces  — PieceCard (compact, highlighted match snippet) │
│ Tags    — [#شام 214 pieces] [#evening 96 pieces]         │
└──────────────────────────────────────────────────────────┘
```

Search covers writer / title / tag / genre / language (Postgres FTS, `simple` +
`unaccent` + `pg_trgm` — expect exact + fuzzy, no stemming; UI never promises
"smart" search). `/tag/:slug` and `/genre/:slug` are filtered Latest feeds with a
header block (name, native name, follow-count, description).

### 3.7 Onboarding & Auth — `/auth/{login,register,forgot-password,reset-password}`

Split layout on desktop: leading 45% panel shows a rotating literary quote on
`--q-bg-raised`; form panel 55% on `--q-bg-canvas`, 400px max form width. Mobile: form
only.

Register steps (single page, progressive):

1. Email + password (or **Continue with Google**). Password: min 8, strength meter
   (border-color shift, no red/green bars — a quiet 3-segment line).
2. **Username — the permanence moment.** Field with live availability check
   (debounced 400ms, `check ✓ available` / `taken`). Below the field, an always-visible
   callout (info-subtle background):
   > **Your username is permanent.** Like ink, it can't be unwritten. Your _pen name_,
   > shown on your work, can change anytime.
   > On submit, a confirm dialog shows `@username` at 31px: _"Write it in ink?"_ —
   > [Choose again] [Yes, this is me]. This is the one deliberate confirm in onboarding.
3. Pen name (prefilled from name/email local-part, editable) + preferred reading
   languages (chips: हिन्दी · اردو · English · …) → seeds the Discover tab.

Errors use the envelope code catalogue: `AUTH_INVALID_CREDENTIALS` → "That email and
password don't match." — never "user not found" (no account enumeration).

### 3.8 Settings — `/settings/{profile,account,appearance}`

Desktop: 240px leading nav (Profile / Account / Appearance) + 640px content column.
Mobile: a list screen that pushes each section.

| Section    | Contents                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile    | Avatar, cover, pen name, bio, links, private-account toggle (toggling to private shows follower-request explainer).                                                                                                                      |
| Account    | Email, password change, connected Google, sessions ("Sign out everywhere"), username shown **read-only with lock icon** and tooltip "Usernames are permanent", danger zone: delete account (typed confirm — the irreversible exception). |
| Appearance | Theme: System / Light / Dark (radio cards with mini previews) · reading size S/M/L · reduced motion override ("Follow system" default).                                                                                                  |

All changes save on interaction (switches) or via a sticky Save bar that appears on
dirty forms (fade-rise, bottom of content column).

### 3.9 Notifications (in-app only — ADR)

Desktop: bell opens a 400px popover (max-height 560px, own scroll); "See all" →
`/notifications` full page. Mobile: tab bar destination, full page.

```
│ Notifications                          Mark all read │
│ ● (avatar) Meera liked your piece "…"        2m      │
│ ● (avatar) 3 people clapped for "شام…"       1h      │  ← grouped (actor collapse)
│   (avatar) Arjun followed you                3h      │
│   (avatar) Zoya responded to your piece      1d      │
```

- Types: like, clap (grouped per piece per day), follow, follow-request (private
  accounts — with Accept/Decline inline), mention, response, repost/quote, moderation
  notices, scheduled-publish confirmations.
- Unread = 4px `--q-accent` dot + `--q-bg-raised` row tint. Opening the popover marks
  _visible_ items read after 1s; "Mark all read" is explicit.
- Badge on bell: dot only (no count on desktop); mobile tab shows count, capped "9+".

### 3.10 Writer Analytics — `/me/stats`

The one intentionally dense reader-app screen — but still on warm paper.

```
┌──────────────────────────────────────────────────────────────────┐
│ Your stats            [Last 7 days ▾]                             │
│ ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐ ┌─────────┐ │
│ │ Views   │ │ Reads   │ │ Read ratio│ │ Reading time│ │Followers│ │
│ │ 12,4k   │ │ 8,1k    │ │ 65%       │ │ 312h        │ │ +214    │ │
│ │ ▲ 12%   │ │ ▲ 8%    │ │ ▼ 2pt     │ │ ▲ 15%       │ │ ▲       │ │
│ └─────────┘ └─────────┘ └───────────┘ └────────────┘ └─────────┘ │
│ [Views over time — line chart, 1px --q-accent, area 8% tint]     │
├──────────────────────────────────────────────────────────────────┤
│ By piece                                                          │
│ Title            Views  Reads  Compl.  Avg time  Shares          │
│ شام کی دہلیز پر   4,2k   3,1k   74%     4m 12s    89              │
│ …                                                                 │
├────────────────────────────┬─────────────────────────────────────┤
│ Countries (top 5, bars)    │ Devices (donut: mobile/desktop/tablet)│
└────────────────────────────┴─────────────────────────────────────┘
```

- Metrics (ADR): views, reads, reading time, completion, shares, followers, traffic,
  countries, devices. Definitions surfaced in tooltips ("A _read_ = 30s+ dwell or 60%+
  scroll") — writers must trust the numbers.
- Deltas compare with the previous equal period. Data comes from `analytics_daily`
  rollups — the header notes "Updated nightly" honestly.
- Per-piece rows link to a piece-detail stats view (same layout, scoped).
- Empty state (no published pieces): _"Numbers need words first. Publish your first
  piece and this page will start keeping count."_ [Start writing]

---

## 4. Interaction Patterns

### 4.1 Optimistic social actions

| Action                        | Optimistic?                                                                | Rollback UX                                               |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Like / unlike                 | Yes — toggle + count instantly                                             | Revert state, toast "Couldn't save your like — try again" |
| Clap (1–50)                   | Yes — per-tap count animation; batched to one request 600ms after last tap | Revert to server count, toast                             |
| Bookmark / save to collection | Yes                                                                        | Revert, toast                                             |
| Follow / unfollow / request   | Yes                                                                        | Revert, toast                                             |
| Repost / quote                | Yes for repost; quote opens editor (not optimistic)                        | —                                                         |
| Publish / delete piece        | **Never optimistic**                                                       | Full round-trip with loading state                        |

All optimistic mutations go through TanStack Query `onMutate`/`onError` cache rollback —
one pattern, defined once in each feature's hooks.

### 4.2 Infinite scroll rules

- Cursor pagination (ADR §5). Fetch next page when the sentinel is **800px** from
  viewport bottom; never on-click "Load more" for feeds (search results paginate with
  URL page state for shareability of the first page only).
- Scroll position is restored on back-navigation (React Router + cached pages).
- Feeds have **no footer**. Legal/footer links live in Settings and the logged-out
  landing page.
- End of feed gets a literary end-cap: _"You've read it all. The rest is unwritten —
  perhaps by you."_ [Write something]
- Never auto-insert above the viewport; new content is announced via the "New pieces"
  pill (§3.1).

### 4.3 Skeleton-first loading

- Content surfaces show layout-matched skeletons (see `07` §7.8) within **100ms**;
  actual spinners only inside buttons (`loading` state) and full-page transitions never
  block on data (route-level suspense with skeleton screens).
- Skeletons animate a 1.8s shimmer; static under `prefers-reduced-motion`.
- Never skeleton-then-jump: skeleton dimensions match real component min-heights.

### 4.4 Empty states — literary voice (canonical copy)

| Surface             | Title                                              | Body / action                                                           |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Following feed      | "Your feed is a blank page."                       | "Follow writers and their words will find you here." [Discover writers] |
| Drafts              | "Nothing here yet — that's how every book starts." | [Write your first draft]                                                |
| Bookmarks           | "No saved pieces."                                 | "When something moves you, keep it here."                               |
| Collections         | "A shelf, waiting for its books."                  | [Create a collection]                                                   |
| Search (no results) | "Nothing found for '…'"                            | "Try a different spelling — we match Hindi, Urdu, and English exactly." |
| Notifications       | "All quiet."                                       | "When readers respond to your words, you'll hear it here."              |
| Private profile     | "This writer keeps a private notebook."            | [Follow to request access]                                              |

Rules: title ≤ 8 words, body ≤ 20, at most one action, never blame the user, never use
exclamation marks.

### 4.5 Error states

- **Inline** (field-level) for validation; **toast** for failed background actions;
  **in-place panel** for failed content loads ("Couldn't load the feed." [Try again]) —
  never a blank screen, never a full-page error for a partial failure.
- Error copy maps from envelope `error.code` in one catalogue
  (`frontend/src/lib/error-messages.ts`); unknown codes fall back to "Something went
  wrong on our side. Your work is safe." with `requestId` available under a "Details"
  disclosure for support.
- Offline (no offline mode — ADR): a passive banner "You're offline — reconnecting…";
  the editor keeps a local copy (§3.3) and reconciles on reconnect.

### 4.6 Undo over confirm

| Action                                                                | Pattern                                          |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| Delete draft, remove bookmark, remove from collection, unfollow, mute | Immediate + 5s undo toast                        |
| Unpublish piece (back to draft)                                       | Immediate + undo toast (10s)                     |
| Delete **published** piece                                            | QDialog, danger, requires typing the piece title |
| Delete account                                                        | QDialog, danger, typed confirm + password        |

---

## 5. Dark Mode UX Rules

- Class strategy: `data-theme="dark"` on `<html>` (Zustand-persisted; system default;
  inline `<head>` script applies before first paint — no flash).
- **Warm near-black, never pure black:** canvas `#131110`. Elevation is expressed by
  **borders + lighter surfaces**, not shadows (ADR §7).
- Images and covers render at `filter: brightness(0.92)` in dark to sit into the page;
  removed on hover/focus of the image itself.
- Reading view dark is tuned for long sessions: text `--q-text-primary` `#ECE6DA` (a
  warm ivory, ~15:1 — deliberately _not_ pure white to reduce halation on serif text).
- Accent shifts to the lighter `#D07349` ramp; buttons in dark use **dark ink text on
  accent** (see contrast table in `07` §2.4).
- Never invert user content (covers, avatars). Charts re-map to the dark ramp, not a
  CSS invert.

---

## 6. RTL UX

Urdu is RTL **day one**. Two independent axes (ADR §6): UI-chrome language (Phase 1:
English, LTR) and content language (per piece / per card).

**Rules:**

1. **CSS logical properties only** — `ms-*`/`me-*`/`ps-*`/`pe-*`, `inset-inline-*`,
   `border-inline-start`, `text-align: start`. Physical `ml-/mr-/pl-/pr-` are banned by
   lint (ADR). This makes full-UI mirroring (Phase 2 Urdu chrome) a `dir` flip, not a
   rewrite.
2. **Content-scoped direction:** the reading body, editor surface, piece titles in
   cards, and search-result snippets each carry `dir` from the piece's language. The
   surrounding chrome keeps the UI direction. Every user-generated inline string
   (titles, pen names) is wrapped in `<bdi>` to prevent bidi spill.
3. **What mirrors** (with content or chrome direction): reading column alignment, the
   action rail side (inline-start of the column), blockquote's accent border
   (`border-inline-start`), list markers, chevrons/arrows meaning next-previous,
   drawer/sheet slide direction, toolbar order, **reading progress bar** — it maps
   position _in the text_, so an Urdu piece fills right→left.
4. **What does NOT mirror:** media/audio playback controls and progress (time is
   universally LTR), clocks, checkmarks, the Qalam wordmark, undo/redo (they reference
   time), code/monospace blocks, phone numbers, URLs, emails, and `@usernames`
   (`^[a-z0-9_]+$` — always LTR, isolate-wrapped).
5. **Numerals policy:** UI chrome, stats, dates, and counts use Latin (ASCII) digits
   everywhere in Phase 1 — including inside Urdu-labeled badges — for one consistent
   numeric voice and unambiguous analytics. Authors' own text is never transformed:
   if a writer types Eastern Arabic-Indic numerals (۱۲۳) or Devanagari digits (१२३),
   they render as written.
6. Mixed-direction lists (e.g., feed with Hindi + Urdu cards) keep a stable card grid;
   only each card's _text block_ flips. Metadata rows (claps, time) stay in chrome
   direction so scanning columns align.

---

## 7. Nastaliq Typography Accommodations

Noto Nastaliq Urdu is vertically demanding — words stack diagonally; clipped descenders
are the #1 rendering bug in Urdu products. Non-negotiables:

| Rule                             | Value                                                           | Why                                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading line-height              | **2.1** (never < 2.0)                                           | Nastaliq's diagonal stacking needs ~2× the vertical room of Latin.                                                                                |
| Reading base size                | **22px** (Latin 20px) — S/M/L: 20/22/24                         | Nastaliq renders optically ~15% smaller at equal px.                                                                                              |
| Headings line-height             | ≥ 1.8 (Latin headings 1.3)                                      | Even single lines clip at Latin heading leading.                                                                                                  |
| Vertical padding on clamped text | +4px block padding on any `line-clamp` container holding Urdu   | Prevents descender clipping at clamp boundaries.                                                                                                  |
| Letter-spacing                   | **0, always**                                                   | Tracking breaks the cursive joining — corrupts the script.                                                                                        |
| Italic                           | **Disabled in Urdu context**                                    | Nastaliq has no italic; faux-oblique is illegible. Editor disables the mark (§3.3); emphasis falls back to color (`--q-accent`) or quote styling. |
| Bold                             | Avoid faux-bold; use size or color for emphasis                 | Noto Nastaliq ships limited weights; synthetic bold smears joins.                                                                                 |
| Underline                        | `text-underline-offset: 0.35em; text-decoration-thickness: 1px` | Default underlines strike through descenders.                                                                                                     |
| Justification                    | `text-align: start`, never `justify`                            | Urdu justification requires kashida support browsers don't do well.                                                                               |

UI chrome strings in Urdu (Phase 2) use **Noto Naskh Arabic**, not Nastaliq — Naskh is
compact and legible at UI sizes; Nastaliq is reserved for reading surfaces and titles.

---

## 8. Responsive Behavior

Breakpoints are Tailwind defaults (ADR §7): 640 / 768 / 1024 / 1280 / 1536.

| Range           | Shell                                                       | Feed                                      | Reading                                                   | Editor                                     |
| --------------- | ----------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| < 640 (base)    | Bottom tab bar (5), top bar 56px                            | 1 col, edge-to-edge cards, swipeable tabs | Full-bleed column, 16px inline padding, bottom action bar | Toolbar docked above keyboard; Next button |
| 640–767 (sm)    | Same as base                                                | 1 col, 24px gutters                       | Column ≤ 68ch, 24px padding                               | Same as base                               |
| 768–1023 (md)   | Top bar only, tab bar removed; nav condenses into bar icons | 1 col centered 680px                      | Rail appears (inline-start)                               | Floating toolbar on selection              |
| 1024–1279 (lg)  | Full top bar with search                                    | Main 680 + sidebar 320                    | Rail + reader settings visible                            | Full layout                                |
| ≥ 1280 (xl/2xl) | Content max 1280 centered                                   | Same, more whitespace                     | Same — the column **never widens** past 68ch              | Same                                       |

Rules: no layout uses more than two columns (except analytics tiles and admin);
touch targets grow to ≥ 44px below `lg` even where desktop uses 32px controls; hover-only
affordances (card overflow menus, footnote popovers) always have tap equivalents.

---

## 9. Accessibility UX

- **Focus order** follows visual/reading order per screen; the reading page order is:
  skip-link → chrome → title → byline (Follow) → body (footnote refs in flow) → rail →
  end-actions → responses. The rail is _after_ the body in DOM (visual position via CSS)
  so readers reach the text first.
- **Touch targets ≥ 44×44px** on touch devices — visually smaller controls (32px rail
  icons) expand their hit area with a pseudo-element.
- **Focus ring:** 2px `--q-accent`, offset 2px, on every interactive element —
  `:focus-visible` only (see `07` §9).
- **Reduced motion:** `prefers-reduced-motion` (plus the Appearance override) disables
  transforms and parallax; opacity-only transitions capped at 150ms; clap burst
  animation becomes a static count increment; shimmer skeletons become static blocks.
- **Screen readers:** autosave and toast regions are `aria-live="polite"`; clap total
  announced after batch settles, not per tap; infinite feeds expose
  `role="feed"` with `aria-busy` during page fetch; language of parts —
  every content block carries `lang` (`lang="ur"`, `lang="hi"`) so screen readers switch
  voices correctly. This is as important as `dir` and is set from the same piece field.
- **Keyboard:** full app operable; editor uses standard shortcuts (Cmd/Ctrl+B/I/U);
  dialogs trap focus and restore it on close; `Esc` always exits the topmost layer.
- Contrast commitments and exact ratios: `07_DesignSystem.md` §2.4 and §9.
