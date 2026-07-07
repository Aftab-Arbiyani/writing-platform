# 10 — Information Architecture

> **Derives from:** `00_ArchitectureDecisions.md` §4 (identity/slug source data), §5 (API),
> §6 (frontend), §10 (canonical route map — the sitemaps below match it exactly and only
> _expand_ it with detail-level sub-routes). Router mechanics live in
> `11_RoutingArchitecture.md`; flow behavior in `09_UserFlows.md`.

**IA principles (govern every section below)**

| #   | Principle                                                  | Consequence                                                                               |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | URLs are the IA — if two screens differ, their URLs differ | Tabs/filters in query params; no modal-only destinations                                  |
| 2   | Public things get names, private things get sections       | Pieces/profiles have slugs; bookmarks/lists live under `/me`                              |
| 3   | The writer's identity is the address                       | `/@:username` — hence the permanent-username contract (ADR §4)                            |
| 4   | Shallow beats clever                                       | Max path depth 3 (`/@:u/collections/:s`); no deep category trees                          |
| 5   | Reading surfaces are script-aware                          | Any node that renders piece content must carry its language's `dir` and typeface (ADR §6) |

---

## 1. Sitemap — frontend (`app.qalam.*`)

```
/                                    Landing (Visitor) / redirect → /feed (User)
├── /feed                            Home feed — ?tab=following|trending|latest|discover
├── /p/:slug                         Piece reader (view/read/completion tracking)
│      └── #responses                Responses section (in-page anchor, not a route)
├── /@:username                      Public profile (pen name, bio, pieces)
│      ├── ?tab=pieces|collections|about   Profile tabs (URL state)
│      └── /collections/:slug        Public collection detail (owner's series)
├── /write                           New piece → replaced by /write/:draftId on first change
├── /write/:draftId                  Editor: draft ⇄ preview ⇄ publish sheet
├── /search                          ?q=&type=top|pieces|writers|tags&language=&genre=&tag=
├── /tag/:slug                       Tag hub (folksonomy axis)
├── /genre/:slug                     Genre hub (curated axis)
├── /me                              Private "my stuff" section (RequireAuth)
│      ├── /me/drafts                Drafts + scheduled pieces (with scheduled_at badges)
│      ├── /me/stats                 Writer analytics — ?range=7d|30d|90d|all
│      ├── /me/bookmarks             All saves (flat)
│      ├── /me/lists                 Reading lists (private playlists of anyone's pieces)
│      └── /me/collections           Manage own public collections
├── /settings                        (RequireAuth) → redirects to /settings/profile
│      ├── /settings/profile         Pen name, bio, avatar, private-account toggle
│      ├── /settings/account         Email, password, linked Google identity, sessions
│      └── /settings/appearance      Theme (light/dark/system), reading typography
└── /auth                            (RequireGuest)
       ├── /auth/login               Email/username + password · "Continue with Google"
       ├── /auth/register            3-step wizard (also hosts Google onboarding steps)
       ├── /auth/forgot-password
       ├── /auth/reset-password      ?token=
       └── /auth/google/callback     OAuth code landing (spinner, no chrome)
```

## 2. Sitemap — admin (`admin.qalam.*`)

Flat by design — an operations console, not a content site. Minimum role per §8 RBAC
(`user < moderator < admin < super_admin`); enforcement spec in `11_RoutingArchitecture.md` §8.

```
/login                               (RequireGuest) admin credentials only
/                                    → redirect /dashboard
├── /dashboard        moderator      KPIs: signups, pieces published, open reports, queue health
├── /users            admin          User directory, suspend/restore, identity view
├── /pieces           moderator      All pieces: filter by status/language/genre, unpublish
├── /reports          moderator      Moderation queue (claim → act; Flow 15, doc 09)
├── /card-templates   admin          Share-card template management
├── /prompts          moderator      Daily writing prompts calendar
├── /languages        admin          Language catalogue (system taxonomy axis)
├── /featured         admin          Featured writers curation (triggers `featured` notification)
├── /analytics        admin          Platform-wide analytics (vs. writer-facing /me/stats)
├── /moderators       admin          Moderator roster management
├── /roles            super_admin    Role assignment (RBAC edits are the crown jewels)
└── /audit-logs       admin          Immutable admin-action trail (read-only)
```

_Why two apps, not one:_ different threat profile (admin behind stricter CSP/origin rules),
different UI center of gravity (AntD tables vs. literary reading surfaces), independent
deploys — already decided in ADR §1's system diagram.

---

## 3. Navigation model

### 3.1 Desktop header (persistent, RootLayout)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Qalam ✒        [ Search…              ]          ✍ Write   🔔(3)   (👤)  │
└──────────────────────────────────────────────────────────────────────────┘
   logo→/         →/search suggestions           /write   panel    user menu
```

| Slot   | Contents                                                               | Why here                                                             |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Left   | Wordmark → `/` (Visitor) or `/feed` (User)                             | Universal convention; RTL UI mirrors via logical properties (ADR §6) |
| Center | Search field (suggestion dropdown → `/search`)                         | Discovery is a first-class promise of the product                    |
| Right  | **Write** (primary CTA), notification bell + panel, avatar → user menu | Writing is the hero — the only filled-accent button in the chrome    |

**User menu (avatar dropdown):** Profile (`/@me-username`) · Drafts · Stats · Bookmarks ·
Lists · Collections · Settings · theme toggle · Sign out. _Rule:_ the user menu holds
**self-referential** destinations (`/me/*`, `/settings/*`); the header holds **world-facing**
actions. Nothing appears in both.

**Visitor header:** search stays; Write / bell / avatar are replaced by _Log in_ and a
filled _Get started_ → `/auth/register`. Tapping any gated action deep-links through
`?returnTo=` (doc 09, cross-flow invariant 2).

### 3.2 Contextual (in-page) navigation

| Surface       | Contextual nav                                                             | Bound to                                    |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| `/feed`       | Tab bar: Following · Trending · Latest · Discover                          | `?tab=` (URL is source of truth, doc 11 §5) |
| `/@:username` | Tabs: Pieces · Collections · About                                         | `?tab=`                                     |
| `/search`     | Tabs: Top · Pieces · Writers · Tags + filter chips                         | `?type=`, `?language=`, `?genre=`           |
| `/settings/*` | Left side-nav: Profile · Account · Appearance                              | path segments (SettingsLayout)              |
| `/p/:slug`    | End-of-piece rail: clap/like/bookmark · respond · repost/quote · responses | in-page                                     |
| `/me/stats`   | Range picker                                                               | `?range=`                                   |

_Rule:_ contextual nav switches **views of the same place** and therefore lives in the URL;
it never duplicates header destinations.

### 3.3 Mobile navigation (< 768 px)

Bottom tab bar (thumb-reachable), header collapses to logo + bell:

```
┌───────────────────────────────────────────────┐
│   🏠 Home    🔍 Search    ✍ Write    👤 You    │
└───────────────────────────────────────────────┘
    /feed      /search      /write    profile sheet → /me/*, /settings/*
```

Notifications stay in the (slimmed) header — a bell is a glanceable indicator, not a
destination you camp in. Write keeps its center-adjacent slot: the primary CTA survives
every breakpoint. Settings/self pages stack behind **You** to keep the bar at four items.

### 3.4 Admin navigation

AntD `Layout` side-nav (AdminShell): all §2 sections, grouped **Overview / Content /
Moderation / Platform / Access**, filtered by the viewer's role (a moderator simply never
sees `/roles`). Header: environment badge (staging/prod), global user search, admin account
menu. No mobile-first design — admin is a desktop console.

---

## 4. Content hierarchy — the reader's mental model

```
                         ┌─────────────────────┐
                         │      PROFILE        │  "a writer I can follow"
                         │  /@:username        │
                         └───────┬─────────────┘
                    writes       │        curates own work into
              ┌──────────────────┤─────────────────────────┐
              ▼                  │                         ▼
     ┌────────────────┐          │               ┌──────────────────────┐
     │     PIECE      │◀─────────┴── contains ───│     COLLECTION       │
     │   /p/:slug     │  (ordered: a series/book)│ /@:u/collections/:s  │
     └───┬────────────┘                          └──────────────────────┘
         │  the reader saves & organizes (private)
         ▼
     ┌────────────────┐        ┌──────────────────────┐
     │    BOOKMARK    │───────▶│    READING LIST      │  "my playlists of
     │  /me/bookmarks │ sorted │      /me/lists       │   anyone's pieces"
     └────────────────┘  into  └──────────────────────┘
```

| Concept          | Mental model                                       | Owner curates   | Visibility               |
| ---------------- | -------------------------------------------------- | --------------- | ------------------------ |
| **Piece**        | The atom. Everything else points at pieces         | —               | piece visibility         |
| **Collection**   | _The writer's shelf_: "part 3 of her series"       | Own pieces only | Public on profile        |
| **Reading list** | _The reader's playlist_: cross-writer, personal    | Anyone's pieces | Private (Phase 1)        |
| **Profile**      | The writer's home: identity + pieces + collections | —               | Public / private account |

_Why collections and reading lists are separate nouns:_ they answer different questions —
"how does the **author** want this read?" vs. "how do **I** want to read?". Merging them
(Medium's "lists") forces one UI to serve both curatorial voices and muddies attribution.
Bookmark stays a third, simpler thing: a save is one tap; organizing is optional homework.

Responses, reposts and quotes are **edges between pieces/profiles**, not containers — they
inherit the target's URL and never mint hierarchy.

**Wayfinding rules (how readers move up and across the hierarchy):**

1. Every piece page links **up** to its author (`/@:username`), its collection ("Part 3 of
   _Raat ki Rani_ →" when applicable), and **across** via its genre and tag chips.
2. Every profile links **down** to pieces and collections via its tabs — never to the
   writer's private surfaces (bookmarks/lists are invisible to visitors by definition).
3. Tag/genre hubs link only **down** to pieces (and via pieces to writers). Hubs never link
   to each other — cross-axis movement happens through `/search` filters, keeping the
   taxonomy axes visibly independent (§4.1).
4. No breadcrumbs. The hierarchy is ≤ 3 levels (IA principle 4) and pieces have multiple
   legitimate parents (author, collection, tag, feed) — a single breadcrumb trail would lie.

## 4.1 Taxonomy — three separate axes

| Axis          | Nature                                    | Created by                                                                                     | Cardinality per piece | Surface            |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| **Tags**      | Folksonomy — emergent vocabulary          | Users (typed or `#hashtag` in editor)                                                          | 0–5                   | `/tag/:slug`       |
| **Genres**    | Curated canon — stable browse tree        | Admins (Phase 1: seed-managed — §10 admin route map is exhaustive and has no genre screen yet) | exactly 1             | `/genre/:slug`     |
| **Languages** | System property — script, `dir`, typeface | Platform (`languages` table, admin `/languages`)                                               | exactly 1             | search/feed filter |

_Why three axes and not one "category" field:_

1. **Different change rates.** Tags churn daily (folksonomy must be free to invent
   _"nazm"_, _"microfiction"_); genres must stay stable or browse pages rot; languages
   change ~never. One vocabulary can't have three governance models.
2. **Different guarantees.** Genre powers curation and admin analytics — it must be
   non-empty and canonical (exactly one). Tags are best-effort color. Language is
   **rendering-critical**: it selects `dir` and typeface (Urdu → RTL + Nastaliq, ADR §6);
   putting it in a folksonomy would let a typo break typography.
3. **Different query semantics.** Search filters combine axes (`genre=poetry` ∧
   `language=ur` ∧ `tag=nazm`); collapsing them into one axis makes that intersection
   inexpressible.

---

## 5. Entity → URL mapping

| Entity                  | Canonical URL                   | Identifier                     | Notes                                                                    |
| ----------------------- | ------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Piece                   | `/p/:slug`                      | slug (frozen at first publish) | never exposes UUID (ADR §4)                                              |
| Profile                 | `/@:username`                   | permanent username (`citext`)  | the permanence warning exists _because_ this is a URL                    |
| Collection              | `/@:username/collections/:slug` | slug unique per owner          | ownership visible in the path                                            |
| Tag                     | `/tag/:slug`                    | slugified tag text             |                                                                          |
| Genre                   | `/genre/:slug`                  | admin-assigned slug            |                                                                          |
| Draft                   | `/write/:draftId`               | UUIDv7                         | private tooling URL — drafts have no public identity, so an ID is honest |
| Reading list / bookmark | `/me/lists`, `/me/bookmarks`    | —                              | private; no per-entity public URL in Phase 1                             |

### 5.1 Piece slug rules

Generated once by `@qalam/utils` `slugify` at **first publish** (drafts have no slug):

1. Normalize: NFKD → `unaccent` → lowercase → spaces/punctuation → `-`; strip to `[a-z0-9-]`; collapse/trim dashes; truncate at 80 chars on a word boundary.
2. **Non-Latin titles** (the launch norm — Hindi/Urdu): if the ASCII residue is < 3 chars, the slug base falls back to `piece`. We do **not** auto-transliterate Devanagari/Nastaliq (_Why:_ machine transliteration is lossy and often embarrassing; a wrong romanization of a poem's title is worse than a neutral one). The publish sheet shows the slug with an optional "edit URL" field so writers can supply their own romanization — the one moment slugs are editable.
3. **Uniqueness suffix:** always append `-{6-char base36 from the piece's UUIDv7}` → `/p/raat-ki-rani-k3x9f2`. Collision-proof without lookup loops, and time-ordered like the PK.
4. **Frozen after publish.** Title edits never change the slug — inbound links, share cards, and analytics keys stay stable. Unpublish/republish keeps the slug reserved.

### 5.2 Canonical URL policy

- Canonical origin: the public frontend origin (`APP_URL`); lowercase paths; no trailing slash.
- Every piece page emits `<link rel="canonical" href="{APP_URL}/p/:slug">` — query params (`?utm_*`, tracking) never fork identity. Profiles canonicalize to `/@:username` with no query.
- `/feed`, `/search`, `/me/*`, `/settings/*` are **application surfaces**, not documents — no canonical claims, excluded from sitemap.

### 5.3 Indexability matrix

| Surface                                            | Indexable               | Mechanism                                                   |
| -------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| Public piece (`visibility=public`, public account) | **Yes**                 | sitemap + OG/Twitter cards (card-template pipeline)         |
| Unlisted piece                                     | No                      | reachable by URL; `noindex,nofollow`; out of sitemap/search |
| Private piece / draft / scheduled                  | Never routable publicly | 404 to non-owners (existence not leaked, doc 09 Flow 7)     |
| Public profile, tag hub, genre hub                 | Yes                     | sitemap                                                     |
| Private-account profile                            | Header only             | `noindex`; pieces gated (doc 09 Flow 10b)                   |
| `/me/*`, `/settings/*`, `/write/*`, notifications  | No                      | RequireAuth + `noindex` + robots disallow                   |
| Admin app (entire origin)                          | No                      | robots disallow all + no public links; auth wall            |

_Rule of thumb:_ if a URL can appear in a search engine, it must be meaningful **without a
session**; everything session-dependent lives under `/me`, `/settings`, `/write`, or admin.
