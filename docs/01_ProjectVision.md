# 01 — Project Vision

> **Derives from:** `00_ArchitectureDecisions.md` (the master ADR). This document explains
> _why Qalam exists_ and _what winning looks like_. Where this document and the ADR appear
> to disagree, the ADR wins and this document gets fixed.

---

## 1. Vision Statement

**Qalam is a premium writing sanctuary** — a global creative writing platform where the
work itself is the product, not the engagement metrics around it.

The name — **Qalam** (قلم / क़लम, _"the pen"_) — is shared vocabulary between Urdu and
Hindi, our two launch audiences. It signals the promise: this is a place built around the
instrument of writing, not around a feed algorithm.

Every product and architectural decision flows from one sentence:

> _Writing is the hero. Everything else — the feed, the social layer, the analytics —
> exists in service of the written piece and is designed to stay out of its way._

**Why "sanctuary" and not "network."** The dominant platforms treat writing as content
inventory for an attention marketplace. Writers who care about craft — poets especially —
experience those platforms as hostile: their scripts render badly, their line breaks are
mangled, their work is ranked below reaction bait. Qalam inverts the priority order:
typography, reading experience, and the writer's control over presentation come first;
distribution mechanics come second and are designed to _respect the work_ (see Pillars, §4).

---

## 2. Problem Statement

Three problems, in descending order of how underserved they are:

| #   | Problem                                                                                                                                                                                                                                                                           | Who feels it                                    | Today's workaround                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | **No serious home for Hindi/Urdu literary writing online.** Existing platforms treat Devanagari as an afterthought and Nastaliq as an impossibility. Urdu poetry circulates as _screenshots of text_ because no platform renders it acceptably.                                   | Hindi & Urdu writers (~600M+ speakers combined) | WhatsApp forwards, Instagram image posts, Facebook groups, print-only journals |
| 2   | **General-purpose platforms are hostile to craft.** Medium, Substack, and blogging tools optimize for essays and newsletters — not poems, ghazals, short fiction, or serialized work. There is no concept of a _piece_ with literary metadata (genre, featured quote, footnotes). | All creative writers                            | Fighting the editor; abandoning formatting; publishing PDFs                    |
| 3   | **The social layer devours the writing.** Where literary communities do exist online, engagement mechanics (likes, virality, infinite scroll) reward volume and outrage over quality, and reader analytics are either absent or weaponized.                                       | Writers _and_ serious readers                   | Private groups; leaving the internet                                           |

The gap: **a platform where a Urdu ghazal, a Hindi short story, and (later) an English
essay are all first-class citizens — beautifully typeset, discoverable, and socially
alive without being socially degraded.**

---

## 3. Why Hindi/Urdu-First Is the Wedge

Launching Hindi/Urdu-first is not a limitation we tolerate — it is the strategic wedge
and the hardest engineering constraint, taken on deliberately.

### 3.1 Underserved scripts, enormous audience

Hindi and Urdu together represent one of the largest writer/reader populations on earth
with effectively **zero purpose-built literary platforms**. English-language writing tools
compete in a saturated market; Devanagari and Nastaliq writing tools compete in an empty
one. A platform that merely _renders these scripts correctly_ clears a bar almost no
competitor has attempted.

### 3.2 Nastaliq typography is a moat

Urdu is properly written in **Nastaliq**, a calligraphic style with steep vertical stacking
and contextual letterforms. Most platforms fall back to Naskh (which Urdu readers register
as "not really Urdu") or break the script entirely. Qalam commits to Nastaliq from day one:

- Reading face: **Noto Nastaliq Urdu**, self-hosted via @fontsource (ADR §6 — no CDN).
- **Line-height ≥ 2 and a larger base size** for Nastaliq (ADR §7) — the script is
  vertically demanding, and cramped Nastaliq is illegible Nastaliq.
- Reading column tuned per script: line-height 1.7 (Latin) vs 2.1 (Nastaliq).

Getting this right is weeks of typographic care that generic platforms will never invest
for a "regional" audience. For us it is the core product.

### 3.3 RTL as a day-one architectural requirement

Urdu is right-to-left. The ADR is explicit: **RTL is a day-one architectural requirement,
not a Phase 2 retrofit** (ADR §0), because retrofitting direction-awareness costs 10× (ADR §6):

- `dir` switches per **content language** — a Hindi piece and an Urdu piece on the same
  screen each get the correct direction.
- **CSS logical properties only** (`ms-*`/`me-*`, `ps-*`/`pe-*`; `ml-*`/`mr-*` are banned
  by lint rule from day one).
- AntD `direction` prop wired to the same signal.

**Why this ordering matters strategically:** a platform built RTL-correct and
Nastaliq-correct from its foundation can expand to Arabic, Persian, and every LTR language
trivially. A platform built LTR-first can never credibly come back for these writers.
Hindi/Urdu-first means the _hardest_ internationalization problems are solved before
launch — Phase 3 global expansion becomes an act of configuration, not re-architecture.

### 3.4 Two scripts, one culture of poetry

Hindi and Urdu share vocabulary, literary forms (ghazal, nazm, doha, kahani), and — most
importantly — audiences. A reader of one frequently reads the other. Launching both
together creates a network denser than either alone, while forcing the platform to be
genuinely multilingual (different scripts, different directions, shared discovery) rather
than superficially localized.

---

## 4. Personas

Three personas anchor Phase 1 scope. Every feature must serve at least one of them.

### Persona 1 — Farheen, the Urdu poet

|                          |                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile**              | 34, Lahore/Lucknow diaspora, writes ghazals and nazms nightly. Publishes to a WhatsApp circle of ~200 and an Instagram account where poems are posted _as images_ because text posts destroy Nastaliq.                                                                                |
| **Goals**                | See her work typeset in true Nastaliq with correct line breaks and generous spacing. Build a findable body of work under one pen name. Reach readers beyond her circle. Attach footnotes for difficult words. Share a beautifully rendered card of a couplet.                         |
| **Frustrations**         | Every platform renders Urdu as cramped Naskh or breaks it entirely. Screenshots are not searchable, not accessible, not hers. Engagement on image posts rewards the image, not the poem. No platform understands what a _ghazal_ is.                                                  |
| **What Qalam gives her** | Nastaliq reading face with line-height ≥ 2, RTL-correct editor and reading view, footnotes as a first-class editor extension, genre/tag taxonomy that knows her forms, share cards (`card_templates`) generated from real text, a permanent `@username` plus one changeable pen name. |
| **Success looks like**   | She stops posting screenshots. Her Qalam profile becomes the canonical home of her work.                                                                                                                                                                                              |

### Persona 2 — Ravi, the Hindi short-story writer

|                          |                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Profile**              | 27, Indore, writes 2,000–5,000-word short stories in Hindi. Serious about craft; wants readers, feedback, and evidence that people actually finish his stories.                                                                                                                                                                                  |
| **Goals**                | A calm long-form editor that doesn't fight Devanagari input. Draft → preview → publish with real metadata (title, subtitle, cover, featured quote, genre, tags). Schedule releases. See honest analytics: reads, reading time, **completion** — not vanity impressions.                                                                          |
| **Frustrations**         | Blog platforms treat Hindi as an edge case (broken word counts, wrong reading-time estimates). Social platforms bury long-form. He has no idea whether anyone reads past paragraph three.                                                                                                                                                        |
| **What Qalam gives him** | TipTap editor with the Phase 1 marks he actually needs (bold, italic, underline, alignment, blockquote, lists) plus footnotes/mentions/hashtags; scheduled publishing via the `scheduled-publish` queue; per-piece analytics (views, reads, reading time, completion, shares — ADR §10); Noto Serif Devanagari reading face at a 65–72ch column. |
| **Success looks like**   | He publishes weekly, watches completion rates improve as he edits tighter, and gains followers who arrive via search and the Following feed rather than luck.                                                                                                                                                                                    |

### Persona 3 — Sana, the reader / curator

|                          |                                                                                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile**              | 41, Delhi, reads in Hindi, Urdu, and English. Doesn't publish. Maintains reading lists for friends and a private habit of collecting couplets. The platform's demand side — and its taste engine.                                                                                                        |
| **Goals**                | A distraction-free reading experience in three scripts with dark mode for night reading. Discover new writers by genre/tag/language. Curate: bookmarks for herself, reading lists and collections to share, reposts and quote-reposts to signal taste.                                                   |
| **Frustrations**         | Feeds optimized for outrage. No serious multilingual discovery anywhere — following Urdu poetry _and_ Hindi fiction means living on two platforms. Curation tools are afterthoughts.                                                                                                                     |
| **What Qalam gives her** | Feed tabs she controls (Following / Trending / Latest / Discover — tab in the URL, shareable); search by writer, title, tag, genre, and language on Postgres FTS; bookmarks, reading lists, collections, repost and quote as first-class social objects; dark mode and per-script typography on day one. |
| **Success looks like**   | Her reading lists become destinations. Writers she curates gain followers — curation becomes a contribution.                                                                                                                                                                                             |

**Why a non-writing persona:** feeds, search, collections, and reading lists — half the
Phase 1 module map — exist for Sana. A writing platform with no deliberate reader
experience is a diary with a login page.

---

## 5. Product Pillars

Four pillars. Every roadmap argument gets settled against them.

### Pillar 1 — Writing is the hero

The piece is the atomic unit of the platform and the most cared-for surface. The editor
(TipTap 3) and the reading view get typography budget before anything else does: serif
reading faces per script (Lora / Noto Serif Devanagari / Noto Nastaliq Urdu), a 65–72ch
reading column at 18–20px, script-correct line heights. TipTap **JSON is canonical**
(ADR §4) — presentation is derived, so the work outlives any renderer.
**Why:** if the reading experience is ordinary, nothing else matters; there are already a
hundred ordinary places to publish.

### Pillar 2 — Calm, minimal UI

_"Warm paper and ink"_ (ADR §7): warm paper canvas (`#FAF7F1`), ink text (`#24211B`),
a single terracotta accent (`#9E4B28`), generous whitespace, soft warm shadows, motion at
150/250/400 ms that respects `prefers-reduced-motion`. Dark mode ships day one. No
infinite-scroll dopamine patterns, no notification badges engineered for anxiety.
**Why:** the audience is people who read and write long-form; calm is a feature they can
feel in the first ten seconds, and it is the visual proof of the sanctuary promise.

### Pillar 3 — A social layer that respects the work

Social mechanics exist and are rich — like, clap (capped at 50 per user per piece,
`MAX_CLAPS_PER_USER = 50`), bookmark, collections, reading lists, share, repost, quote,
and written responses (piece → piece) — but they are designed as _ways of honoring a
piece_, not ways of farming engagement. Notifications are **in-app only** (ADR §10): the
platform never chases users into their inbox or lock screen. Private accounts are
supported; visibility is enforced in the query layer on every read path.
**Why:** the social layer is the growth engine, but the moment it starts optimizing
against the reader's attention, Pillar 1 and Pillar 2 are dead and the differentiation
with it. A _response_ being a full written piece — rather than a comment box — is the
clearest expression of this pillar.

### Pillar 4 — Multilingual by design

One language per piece (a deliberate simplification — ADR §10), `dir` derived from
content language, script-specific fonts and metrics, `languages` as a first-class admin-
managed taxonomy table, and search that is honest about Hindi/Urdu: **PostgreSQL FTS with
the `simple` config + `unaccent` + `pg_trgm`** because no credible Hindi/Urdu stemmers
exist — exact and fuzzy matching that works beats stemming that lies (ADR §3). UI-chrome
i18n (react-i18next) lands in Phase 1, but is a separate axis from content language and
is never confused with it.
**Why:** "multilingual" bolted on is what every failed competitor did. Built in, it makes
Phase 3 a market expansion instead of a rewrite.

---

## 6. Success Metrics

Metrics come from Qalam's own analytics pipeline (`analytics_events` → BullMQ
`analytics-rollup` → `analytics_daily`, ADR §4) — no third-party analytics required to
run the business.

| Metric                        | Definition                                                                                                                                  | Phase 1 target                                  | Why this metric                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activation**                | % of new signups who complete a profile **and** save a draft of ≥ 100 words within 7 days of registration                                   | ≥ 30%                                           | Proves onboarding lands people in the editor, not the feed. Drafting — not publishing — is the honest first-value moment for writers.                                |
| **Weekly writers**            | Unique accounts that create or edit a draft, or publish, in a trailing 7-day window                                                         | Growing week-over-week; ≥ 20% of MAU            | Supply-side heartbeat. A writing platform where writing is not the weekly habit is a reading app in denial.                                                          |
| **Read-through / completion** | Median % of a piece actually read (scroll-depth + dwell heuristics feeding the `completion` analytic, ADR §10), plus % of opens that finish | ≥ 50% median completion on pieces < 1,500 words | The Pillar 1 metric. High completion means typography, length, and feed quality are working _together_. It is also the writer-facing analytic Ravi cares about most. |
| **D30 retention**             | % of a signup cohort active (any authenticated read or write event) 30 days later                                                           | ≥ 20%                                           | The sanctuary test. Engagement-mechanic platforms spike D1 and die by D30; a habit product shows up here.                                                            |

Guardrail metrics (watched, not targeted): report rate per 1,000 published pieces
(moderation health), search zero-result rate (taxonomy and FTS health), scheduled-publish
job failure rate (trust — a missed scheduled ghazal is a broken promise).

**Why so few metrics:** four numbers the whole team can hold in their heads beat a
dashboard nobody owns. Each pillar has exactly one metric that would expose its failure.

---

## 7. Scope by Phase

Phases are gates, not sprints. A phase ships when its exit criteria hold, not on a date.

### Phase 0 — Foundation (current)

Everything that makes Phase 1 buildable at speed, with zero product features:

- Monorepo: pnpm 9 workspaces + Turborepo 2, Node 24 LTS, TypeScript ^5 `strict` everywhere.
- The five `@qalam/*` packages scaffolded with their disjoint responsibilities (ADR §2).
- `docker-compose.yml` dev infra: postgres 16, redis 7, MinIO, mailpit (default profile
  is infra-only; apps run via `pnpm dev`).
- CI (`.github/workflows/ci.yml`): lint → typecheck → test → build on PR + main;
  conventional-commit title check.
- Design tokens (`--q-*` CSS variables) defined once in `@qalam/ui`, feeding both the
  AntD 5 theme and the Tailwind 4 theme.
- Backend skeleton: `main.ts` bootstrap (helmet, CORS, URI versioning, pipes, Swagger,
  Pino), Zod-validated env, `common/`, `database/` with migration tooling.
- Documents 00–18.

**Exit criterion:** a new engineer clones, runs `pnpm i && docker compose up -d && pnpm dev`,
and has API (4000), frontend (5173), and admin (5174) running with green CI. **Why a
whole phase for this:** foundation debt compounds; every Phase 1 module pays interest on it.

### Phase 1 — MVP (Hindi/Urdu launch)

The 14 backend modules (ADR §3) and the product surface locked by the brief (ADR §10):

| Area               | Scope                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & identity    | Email+password and Google OAuth (code + PKCE); JWT access 15 min + rotating refresh 30 days; permanent unique `username`, one changeable `pen_name`; private accounts        |
| Writing            | TipTap editor — bold, italic, underline, alignment, blockquote, lists; custom extensions: footnotes, mentions, hashtags; autosaving drafts                                   |
| Publishing         | Draft → preview → publish with title, subtitle, cover image, featured quote, tags, genre, language, visibility; scheduled publish (BullMQ)                                   |
| Discovery          | Feed tabs Following/Trending/Latest/Discover; search by writer/title/tag/genre/language (Postgres FTS); tag & genre pages                                                    |
| Social             | Like, clap (≤ 50), bookmark, collections, reading lists, share, repost, quote, write-response                                                                                |
| Notifications      | In-app only                                                                                                                                                                  |
| Analytics          | Writer dashboard: views, reads, reading time, completion, shares, followers, traffic, countries, devices                                                                     |
| Moderation & admin | Reports pipeline; full admin panel — dashboard, users, pieces, reports, card templates, daily prompts, languages, featured writers, analytics, moderators, roles, audit logs |
| Media              | Pre-signed uploads, sharp processing, EXIF/GPS stripping                                                                                                                     |

**Exit criterion:** the three personas can each complete their core loop end-to-end in
Hindi and Urdu, and the four success metrics are instrumented and reporting.

### Phase 2 — AI, payments, Apple login

Deliberately deferred, together, because each has heavy compliance/UX weight (ADR §10):

- **AI features** — assistance in service of the writer (never auto-generated feed content).
  Scope defined at Phase 2 entry; _nothing_ AI ships earlier.
- **Payments / monetization** — supporting writers financially; model chosen with real
  usage data in hand.
- **Apple login** — added alongside the mobile push, when its account-hiding email relay
  and review requirements are worth absorbing.

### Phase 3 — Global

- Additional content languages and scripts (Arabic and Persian are near-free after Urdu;
  Bengali, Tamil, Punjabi follow the Devanagari playbook).
- Expanded UI-chrome locales.
- Search scale-out if needed: Meilisearch behind the existing `SearchService` seam —
  designated successor, decided by data, not fashion (ADR §3).
- Mobile (Flutter) expansion as demand dictates — the contract is ready from day one,
  since Flutter generates Dart models from the same exported `openapi.json` that feeds
  `@qalam/api-types` (ADR §2).

### Explicit Non-Goals

Named so nobody relitigates them casually. Changing any of these means changing the ADR first.

| Non-goal                           | Scope of the "no"                                                                                                                                  | Why                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No offline mode**                | No offline editing, no local-first sync, no service-worker document store — any phase until explicitly re-decided                                  | Offline sync is a distributed-systems project in disguise; it would consume the typography and social budget that _is_ the product.                  |
| **No email or push notifications** | Notifications are in-app only. (Transactional auth email — e.g. password reset via SMTP/mailpit — is account plumbing, not notification delivery.) | Pillar 3: the sanctuary does not follow users home. Also deletes deliverability, template, and push-infra workstreams from the MVP.                  |
| **No AI in Phase 1**               | No AI writing help, moderation, recommendations, translation — nothing                                                                             | Phase 1 must prove humans want to write and read here. AI before product-market fit obscures the signal and burns trust with a craft-first audience. |
| **No payments in Phase 1**         | No subscriptions, tips, or paywalls                                                                                                                | Monetizing an empty room. Phase 2, with data.                                                                                                        |
| **No native apps in Phase 1**      | Web (responsive) first; the API contract is mobile-ready via OpenAPI codegen                                                                       | One excellent surface beats three mediocre ones.                                                                                                     |
| **No microservices**               | Modular monolith with enforced boundaries (ADR §1); extraction seams exist for `workers`, `search`, `analytics`                                    | 90% of the extraction benefit at 10% of the cost for a small team.                                                                                   |

---

## 8. One-Line Summary

**Qalam wins by taking Hindi and Urdu writers seriously before anyone else does — and by
building the typography, direction-handling, and calm that "seriously" requires into the
foundation, so that going global later is expansion, not repair.**
