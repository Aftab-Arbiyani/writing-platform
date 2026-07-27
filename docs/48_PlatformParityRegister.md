# 48 — Platform Parity Register (web ↔ mobile)

**Status:** 🔒 Binding · **Owner:** every client epic · **Last swept:** 2026-07-27 (after W2)

> **The rule.** **Web and mobile ship the same features.** Neither platform is allowed to drift
> ahead of the other with product surface that the other has no plan for. A divergence is only
> acceptable when it is (a) recorded in this register, and (b) either assigned to an epic that
> closes it or classified as platform-inherent in §4.
>
> **Nothing new gets built that is not in [45](./45_WebClientRoadmap.md).** An epic delivers the
> surface its roadmap row names — porting from the platform that already has it — and nothing more.
> "It would be nice to also add…" is how the two clients drift apart, and closing that drift later
> costs more than the feature was worth.

This register is the single source of truth for **where the two clients differ today**. It is swept
at the end of every client epic (step 7 of the per-epic flow, [45 §2](./45_WebClientRoadmap.md)).

---

## 1. Why this document exists

Mobile shipped **M1–M10 + AF1–AF6 + P7.1–P7.4** and is the most complete surface in the product.
Every AF epic shipped **backend + mobile** and deferred **frontend + admin**, which is the gap the
W-track closes. So the default direction is **mobile → web**: mobile is the reference
implementation, and a W epic ports from it rather than inventing.

That default has one failure mode, and it has already happened once (§3): building a surface on web
that mobile does not have. It is not "extra value" — it is an unplanned divergence that some future
epic now has to reconcile.

---

## 2. Current divergences (mobile → web: web is behind)

Measured from `lib/features/**/presentation/screens` and `frontend/src/features/**/pages` plus route
tables, not assumed.

| #   | Area                  | Mobile has                                                                                                               | Web has                                     | Closed by                                                                                                                 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Collaboration**     | 6 screens: collaborators, comments, invitations inbox, publishing workflow, restricted state, suggestions                | nothing                                     | **W3**                                                                                                                    |
| 2   | **Monetization**      | 5 screens: plans, subscription, billing history, credit dashboard, usage dashboard                                       | nothing                                     | **W4**                                                                                                                    |
| 3   | **AI breadth**        | 8 screens: conversation, conversations list, discovery, usage, ask-book, prompt library, semantic search, story explorer | in-editor assistant + Craft Coach only (W2) | **W5** (discovery/search/ask), **W6** (story explorer); conversations + prompt library + AI usage **unassigned — see §5** |
| 4   | **Social depth**      | collections, collection detail, comments, responses (+ followers, follow requests)                                       | follow requests; followers via a dialog     | **unassigned — see §5**                                                                                                   |
| 5   | **Reader actions**    | clap (1..50 accumulating) and report, on the reader action bar                                                           | like, bookmark, copy-link share             | **unassigned — see §5**                                                                                                   |
| 6   | **Reading analytics** | `reading_analytics_screen` — the _reader's_ own stats                                                                    | writer + per-piece analytics only           | **unassigned — see §5**                                                                                                   |
| 7   | **Onboarding**        | `onboarding_screen` — first-run flow                                                                                     | nothing                                     | **unassigned — see §5**                                                                                                   |
| 8   | **Privacy prefs**     | dedicated privacy screen: private account, **show bookmarks count**, **show reading-history count**                      | private-notebook toggle inside edit-profile | **unassigned — small, see §5**                                                                                            |
| 9   | **Offline behaviour** | engagement + follow taken offline are queued and reconciled by a unified `SyncEngine`                                    | no offline write queue                      | **see §4** (partly platform-inherent)                                                                                     |

---

## 3. Divergence created by web (web → mobile: mobile is behind)

**One item, and it was a mistake of scope, recorded rather than quietly kept.**

| #   | Area                          | Web has                                                                           | Mobile has | Resolution                                                                                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| W-1 | **Reader → "More like this"** | Up to 4 pieces sharing the piece's first tag, via `GET /search/pieces?tag=…` (W1) | nothing    | ✅ **Decided 2026-07-27: port to mobile.** Scheduled as the **next task**, ahead of W3 — see §3.1. |

**How it happened, so it does not happen again.** [45 §4.1](./45_WebClientRoadmap.md) lists
"Author card + related pieces — mobile's `reader_author_card`". Mobile's author card contains the
author card and **no related pieces** — the phrase was the roadmap's aspiration, not a description
of something to port. It was built on web without checking that the named reference actually
contained it.

**The lesson for every future epic:** when a roadmap bullet says "port mobile's X", **open X and
confirm it contains what the bullet claims** before building. If it does not, the bullet is a new
feature request, not a port — and it goes back to the roadmap for a decision instead of being built.

### 3.1 Resolution — port to mobile, first, before anything else

**Decided 2026-07-27.** Parity is restored by adding the section to mobile rather than removing it
from web. It is the **next task in the queue**, ahead of W3 and every other W-track row.

Scope, so it stays a port and not a redesign:

- A "More like this" section under the reader, matching what web ships: up to **4** pieces sharing
  the piece's **first tag**, with the current piece filtered out, rendered under the author card.
- Same data path — `GET /search/pieces?q=<tag name>&tag=<tag slug>&sort=trending`. **No backend
  change**; the AF4 recommender still needs `ai.use` and stays out of reach for this surface.
- Non-critical, exactly as on web: **no tags → no section**, and a failed load renders nothing
  rather than an error. It must never cost the reader the piece they came for.
- Reference: `frontend/src/features/reading/{hooks/use-related-pieces.ts,components/related-pieces.tsx}`
  and `api/reading.api.ts#related`. Mobile lands it in `lib/features/reading/` following that
  feature's existing repository → controller → widget layering.

When it lands: delete this row from §3, note the port in the mobile epic's report, and re-date the
sweep at the top of this document.

---

## 4. Divergences that are NOT gaps (platform-inherent)

These are accepted permanently and need no epic. They exist because the platforms genuinely differ.

| Mobile-only                  | Why it is not a web gap                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `splash`, `shell`            | App launch + native navigation shell. The web equivalent is the router + app layout.                                          |
| `storage` screen             | Device cache management (clear cached pieces/images). A browser owns its own cache.                                           |
| `gallery` page               | Native media picker/gallery. The web uses the file input + the existing cover uploader.                                       |
| Offline **read** cache       | Mobile caches pieces for offline reading via Hive boxes. Web has a service worker + the offline route, deliberately narrower. |
| Screenshot protection (P7.2) | A mobile OS capability with no browser equivalent.                                                                            |
| Haptics                      | No web analog.                                                                                                                |

**Partly inherent (item 9 above):** offline _reading_ is inherent, but the **offline write queue**
(like/bookmark/follow taken offline, reconciled on reconnect) is a real product behaviour that web
simply lacks. It is not required for parity of _features_, but it is a parity gap in _behaviour_ —
flagged here so a future epic decides explicitly rather than by omission.

---

## 5. The unassigned gaps — a real hole in the plan

Items **3 (partly), 4, 5, 6, 7, 8** and **W-1** are not owned by any W-track row. The W-track was
written to close the AF1–AF6 client gap, and these fall outside those AF epics:

- **Conversation layer** — comments and responses have UI on mobile and none on web. `W3` is
  collaboration/trust and `W4` is monetization; **neither owns comments/responses**.
- **Collections** — mobile has a collections list + detail; web has neither, and no row covers it.
- **Clap / report** — deliberately scoped out of W1, with no row that picks them up.
- **Reader analytics, onboarding, privacy prefs, AI conversations + prompt library + usage** — all
  mobile-shipped, none in the W-track.

**This needs a roadmap decision, not more building.** The honest options are (a) add a `W7 —
engagement & parity backfill` row covering items 4, 5, 6, 8 and W-1, plus a `W8` for the remaining
AI surfaces, or (b) explicitly accept them as mobile-only and record that here. Until one of those
happens they are **tracked, unowned gaps** — which is better than being invisible, and worse than
being planned.

---

## 6. Parity check — run at the end of every client epic

Added to the per-epic flow as step 7 ([45 §2](./45_WebClientRoadmap.md)):

1. **Did this epic deliver only what its roadmap row named?** Anything extra is a divergence — take
   it out, or record it in §3 with a resolution.
2. **Does the platform that already had this feature actually have every part I built?** Open the
   reference screens and compare, surface by surface. Do not trust a roadmap paraphrase (§3).
3. **Does the other platform now need a follow-up?** If yes, add a row to §3.
4. **Re-sweep §2** for the area touched, and update the "Last swept" date at the top.
5. **Nothing is left unrecorded.** A known difference that is in neither §2, §3 nor §4 is a bug in
   this document.
