import { type APIRequestContext, expect } from '@playwright/test';

/**
 * Backend REST helper (docs/e2e/02 §4). Uses Playwright's server-side
 * `APIRequestContext`, so calls bypass browser CORS and are the fast path for
 * ARRANGING state and ASSERTING server-side side effects.
 *
 * GUARD RAIL (docs/e2e/09): this helper intentionally exposes NO hard-delete /
 * truncate / DDL method. Removal, where a test needs it, goes through the app's
 * soft-delete endpoints only.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@qalam.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1';
// The seeded, pre-verified writer (backend e2e-fixtures.seed.ts) — same identity
// the frontend storageState logs in as. Used here to arrange pieces over REST.
const WRITER_EMAIL = process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local';
const WRITER_PASSWORD = process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly isEmailVerified: boolean;
}

export interface LoginResult {
  readonly user: AuthUser;
  readonly accessToken: string;
}

export interface ThrowawayUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

export interface AdminUserDetail {
  readonly id: string;
  readonly status: 'active' | 'suspended' | 'deactivated';
  readonly role?: string;
  readonly [key: string]: unknown;
}

/** A feature-flag row as `GET /admin/feature-flags` returns it. */
interface FeatureFlagRow {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
}

/** Enough of a flag's prior state to put it back byte-for-byte. */
export interface FeatureFlagRestore {
  readonly id: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
}

export interface PieceSummary {
  readonly id: string;
  readonly slug: string | null;
  readonly title: string | null;
  readonly status: 'draft' | 'scheduled' | 'published' | 'archived';
}

/**
 * A piece comment as `CommentResponseDto` returns it (W7a). `author` is null on a soft-deleted
 * node, and there is no `replies` array — `replyCount` plus `GET /comments/:id/replies`.
 */
export interface CommentSummary {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly body: string;
  readonly isDeleted: boolean;
  readonly replyCount: number;
  readonly editedAt: string | null;
}

/** A collection as `CollectionResponseDto` returns it (W7b). Owner-scoped; private by default. */
export interface CollectionSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly isDefault: boolean;
  readonly piecesCount: number;
}

/** `ClapResponseDto` — this viewer's running count and the piece total. */
export interface ClapSummary {
  readonly viewerClaps: number;
  readonly totalClaps: number;
}

export class ApiHelper {
  private adminTokenCache: string | null = null;
  private writerTokenCache: string | null = null;

  constructor(private readonly request: APIRequestContext) {}

  /** Unwrap the success envelope `{ success, data }`; fail loudly on error. */
  private async data<T>(res: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
    const body = (await res.json()) as { success: boolean; data?: T; error?: unknown };
    expect(
      res.ok() && body.success,
      `API ${res.url()} → ${res.status()} ${JSON.stringify(body.error ?? body)}`,
    ).toBeTruthy();
    return body.data as T;
  }

  private url(path: string): string {
    return `${API_URL}${path}`;
  }

  /** Log in and return the access token + user (web client → refresh via cookie). */
  async login(email: string, password: string): Promise<LoginResult> {
    const res = await this.request.post(this.url('/auth/login'), { data: { email, password } });
    return this.data<LoginResult>(res);
  }

  /** Register a new (unverified) account. */
  async register(input: {
    email: string;
    username: string;
    password: string;
  }): Promise<LoginResult> {
    const res = await this.request.post(this.url('/auth/register'), { data: input });
    return this.data<LoginResult>(res);
  }

  /** Lazily obtain (and cache) a super-admin access token. */
  private async adminToken(): Promise<string> {
    if (this.adminTokenCache === null) {
      const { accessToken } = await this.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      this.adminTokenCache = accessToken;
    }
    return this.adminTokenCache;
  }

  private async adminHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.adminToken()}` };
  }

  /**
   * Create a throwaway, email-verified user (docs/e2e/04 §6): register, then
   * verify via the admin endpoint so the account can log in immediately.
   */
  async createVerifiedUser(input: {
    email: string;
    username: string;
    password: string;
  }): Promise<ThrowawayUser> {
    const { user } = await this.register(input);
    const res = await this.request.post(this.url(`/admin/users/${user.id}/verify`), {
      headers: await this.adminHeaders(),
      data: {},
    });
    await this.data(res);
    return { id: user.id, email: input.email, username: input.username, password: input.password };
  }

  /** Suspend a user via the admin endpoint (arrange/verify for admin flows). */
  async suspendUser(id: string, reason = 'e2e suspend'): Promise<void> {
    const res = await this.request.post(this.url(`/admin/users/${id}/suspend`), {
      headers: await this.adminHeaders(),
      data: { reason },
    });
    await this.data(res);
  }

  /** Read an admin user detail (assert side effects like status changes). */
  async getAdminUser(id: string): Promise<AdminUserDetail> {
    const res = await this.request.get(this.url(`/admin/users/${id}`), {
      headers: await this.adminHeaders(),
    });
    return this.data<AdminUserDetail>(res);
  }

  /** Lazily obtain (and cache) the seeded writer's access token. */
  private async writerToken(): Promise<string> {
    if (this.writerTokenCache === null) {
      const { accessToken } = await this.login(WRITER_EMAIL, WRITER_PASSWORD);
      this.writerTokenCache = accessToken;
    }
    return this.writerTokenCache;
  }

  private async writerHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.writerToken()}` };
  }

  /**
   * A minimal, non-empty TipTap doc so the piece has a word count > 0 and is
   * publishable (mirrors the backend e2e seed's `tiptapDoc`). Content shape, not prose.
   */
  private tiptapDoc(text: string): Record<string, unknown> {
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
  }

  /**
   * Create a DRAFT piece as the seeded writer (POST /pieces). `genreSlug` +
   * `languageCode` default to seeded taxonomy so the draft is publishable as-is.
   *
   * `tags` are free-form names the taxonomy resolves (creating any that are new). They matter to the
   * AF4 rows: the recommender seeds a piece-scoped request from the piece's own tags (W5-2), and the
   * reader's older tag-search fallback needs at least one tag to run at all — so a test that wants to
   * tell those two sources apart has to arrange a tagged piece.
   */
  async createPiece(input: {
    title: string;
    genreSlug?: string;
    languageCode?: string;
    body?: string;
    tags?: string[];
  }): Promise<PieceSummary> {
    const res = await this.request.post(this.url('/pieces'), {
      headers: await this.writerHeaders(),
      data: {
        title: input.title,
        genreSlug: input.genreSlug ?? 'short-story',
        languageCode: input.languageCode ?? 'en',
        content: this.tiptapDoc(input.body ?? `${input.title} — seeded by the E2E suite.`),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
    });
    return this.data<PieceSummary>(res);
  }

  /** Publish a draft piece as the writer (POST /pieces/:id/publish). Returns the published piece. */
  async publishPiece(id: string): Promise<PieceSummary> {
    const res = await this.request.post(this.url(`/pieces/${id}/publish`), {
      headers: await this.writerHeaders(),
      data: {},
    });
    return this.data<PieceSummary>(res);
  }

  /**
   * Arrange a published piece in one call (create draft → publish) — the fast path
   * for seeding feed/discover content without driving the editor UI (docs/e2e/02 §4).
   */
  async createPublishedPiece(input: {
    title: string;
    genreSlug?: string;
    languageCode?: string;
    body?: string;
    tags?: string[];
  }): Promise<PieceSummary> {
    const draft = await this.createPiece(input);
    return this.publishPiece(draft.id);
  }

  /** Log in and return just the access token (for arranging actions as an arbitrary user). */
  async loginToken(email: string, password: string): Promise<string> {
    return (await this.login(email, password)).accessToken;
  }

  /**
   * Set a user's display name as themselves (`PATCH /me`).
   *
   * Exists for the visual baselines (B3, docs/45 §4). Since every id-bearing surface resolves a
   * real profile, the rendered label is now the PEN NAME — and a throwaway user's pen name defaults
   * to `data.username()`, whose LENGTH varies per run (`e2e_<seed>-<worker>-<n>`). Masking hides a
   * row's pixels but not its box, so a variable-length name is a variable-width baseline. Pinning
   * the name is what keeps a re-mint reproducible.
   */
  async setPenName(token: string, penName: string): Promise<void> {
    const res = await this.request.patch(this.url('/me'), {
      headers: { Authorization: `Bearer ${token}` },
      data: { penName },
    });
    await this.data(res);
  }

  /** The seeded writer's user id (e.g. the followee target for a notification arrange). */
  async writerId(): Promise<string> {
    return (await this.login(WRITER_EMAIL, WRITER_PASSWORD)).user.id;
  }

  // ── Collaboration (AF6 / W3a, docs/49) ────────────────────────────────────────────────────

  /**
   * Invite a user to a story as the seeded writer (POST /stories/:id/invitations).
   *
   * Takes `inviteeId` — a **user id**, never an email or handle. The endpoint requires exactly
   * `{ inviteeId, role }` under `forbidNonWhitelisted`, which is the assumption mobile got wrong
   * (defect M-1, docs/48 §3.1). Arranging state through the same shape the UI sends means this
   * fixture would break alongside the UI if the contract ever moved.
   */
  async inviteToStory(
    storyId: string,
    inviteeId: string,
    role: 'co_author' | 'editor' | 'reviewer' | 'beta_reader' = 'editor',
  ): Promise<{ id: string; storyId: string; status: string }> {
    const res = await this.request.post(this.url(`/stories/${storyId}/invitations`), {
      headers: await this.writerHeaders(),
      data: { inviteeId, role },
    });
    return this.data<{ id: string; storyId: string; status: string }>(res);
  }

  /** A story's collaborators as the seeded writer (GET /stories/:id/members). */
  async storyMembers(storyId: string): Promise<{ userId: string; role: string }[]> {
    const res = await this.request.get(this.url(`/stories/${storyId}/members`), {
      headers: await this.writerHeaders(),
    });
    return this.data<{ userId: string; role: string }[]>(res);
  }

  // ── Publishing + trust (AF6 / W3c, docs/49 §5) ────────────────────────────────────────────

  /**
   * Create a draft as an arbitrary user (POST /pieces as the bearer of `token`).
   *
   * The writer-scoped {@link createPiece} cannot serve the restricted-wall flow: that needs a
   * throwaway account carrying a restriction, and restricting the SHARED writer would leak into
   * every other spec in the suite.
   */
  async createPieceAs(
    token: string,
    input: { title: string; body?: string },
  ): Promise<PieceSummary> {
    const res = await this.request.post(this.url('/pieces'), {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: input.title,
        genreSlug: 'short-story',
        languageCode: 'en',
        content: this.tiptapDoc(input.body ?? `${input.title} — seeded by the E2E suite.`),
      },
    });
    return this.data<PieceSummary>(res);
  }

  /**
   * Apply an account restriction as an admin (POST /admin/users/:id/restrictions).
   *
   * This is how the restricted-state wall is arranged: the Policy Engine resolves the trust status
   * from these rows, so a restricted user's capability decisions come back with a restrictive
   * `effect` — which is the wall's trigger. Returns the restriction id so a test can lift it.
   */
  async restrictUser(
    userId: string,
    input: {
      type: 'read_only' | 'muted' | 'restricted' | 'shadow' | 'suspended';
      scope?: 'global' | 'publishing' | 'collaboration' | 'comments' | 'reporting';
      reason?: string;
    },
  ): Promise<{ id: string; type: string; scope: string }> {
    const res = await this.request.post(this.url(`/admin/users/${userId}/restrictions`), {
      headers: await this.adminHeaders(),
      data: {
        type: input.type,
        scope: input.scope ?? 'global',
        reason: input.reason ?? 'e2e restriction',
      },
    });
    return this.data<{ id: string; type: string; scope: string }>(res);
  }

  /** Lift a restriction (DELETE /admin/restrictions/:id) — teardown for the wall flow. */
  async liftRestriction(id: string): Promise<void> {
    const res = await this.request.delete(this.url(`/admin/restrictions/${id}`), {
      headers: await this.adminHeaders(),
    });
    await this.data(res);
  }

  /** Block a user as the bearer of `token` (POST /users/:id/block) — arranges the blocks list. */
  async blockUser(targetUserId: string, token: string): Promise<{ id: string; kind: string }> {
    const res = await this.request.post(this.url(`/users/${targetUserId}/block`), {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    return this.data<{ id: string; kind: string }>(res);
  }

  /** Mute a user as the bearer of `token` (POST /users/:id/mute). */
  async muteUser(targetUserId: string, token: string): Promise<{ id: string; kind: string }> {
    const res = await this.request.post(this.url(`/users/${targetUserId}/mute`), {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    return this.data<{ id: string; kind: string }>(res);
  }

  /** Request a review as the seeded writer (POST /stories/:id/review) — no body. */
  async requestReview(storyId: string): Promise<{ id: string; state: string }> {
    const res = await this.request.post(this.url(`/stories/${storyId}/review`), {
      headers: await this.writerHeaders(),
      data: {},
    });
    return this.data<{ id: string; state: string }>(res);
  }

  /**
   * Approve a story's review as the ADMIN (POST /stories/:id/review/approve).
   *
   * The admin arranges it through the Policy Engine's STAFF path (`publishing.approve`). The author
   * can now approve their own story too — the route's coarse gate is `collaboration.use` and the
   * ownership rule allows the owner (W3c-1 closed, docs/48 §3.4) — so a test that wants the author's
   * own approval should drive the UI rather than call this.
   */
  async approveReview(storyId: string): Promise<{ id: string; state: string }> {
    const res = await this.request.post(this.url(`/stories/${storyId}/review/approve`), {
      headers: await this.adminHeaders(),
      data: {},
    });
    return this.data<{ id: string; state: string }>(res);
  }

  /**
   * A story's version history as the seeded writer (GET /stories/:id/snapshots).
   *
   * Answers an OBJECT, not an array: B7 clamps `items` to the story owner's plan depth and sends
   * the true `total` alongside (docs/45 §4.12).
   */
  async storySnapshots(storyId: string): Promise<{
    items: { id: string; version: number; reason: string }[];
    total: number;
    visible: number;
    hidden: number;
    limit: number;
    unlimited: boolean;
  }> {
    const res = await this.request.get(this.url(`/stories/${storyId}/snapshots`), {
      headers: await this.writerHeaders(),
    });
    return this.data(res);
  }

  /**
   * Capture one content version as the writer (POST /stories/:id/snapshots, no body).
   *
   * Deliberately arrangeable in a loop: B7's clamped state only appears once a story has more
   * versions than the plan shows, and capture is never refused on a plan limit — so pushing a free
   * writer's story past its depth is both possible and the only way to render that state.
   */
  async captureSnapshot(storyId: string): Promise<{ id: string; version: number }> {
    const res = await this.request.post(this.url(`/stories/${storyId}/snapshots`), {
      headers: await this.writerHeaders(),
      data: {},
    });
    return this.data<{ id: string; version: number }>(res);
  }

  /** Follow a user as the bearer of `token` (POST /users/:id/follow, no body). */
  async follow(targetUserId: string, token: string): Promise<{ status: string }> {
    const res = await this.request.post(this.url(`/users/${targetUserId}/follow`), {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    return this.data<{ status: string }>(res);
  }

  /** File a report against an entity as the bearer of `token` (POST /reports). Returns the report. */
  async report(
    input: {
      entityType: 'piece' | 'comment' | 'user' | 'response';
      entityId: string;
      reason?: string;
      description?: string;
    },
    token: string,
  ): Promise<{ id: string; status: string }> {
    const res = await this.request.post(this.url('/reports'), {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason ?? 'spam',
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
    return this.data<{ id: string; status: string }>(res);
  }

  /** Read a report's admin detail (assert resolution status side effects). */
  async getReport(id: string): Promise<{ id: string; status: string; resolution?: string | null }> {
    const res = await this.request.get(this.url(`/admin/reports/${id}`), {
      headers: await this.adminHeaders(),
    });
    return this.data(res);
  }

  /** Mint a moderator: create a verified user, promote to moderator (super-admin), return creds. */
  async createModerator(input: {
    email: string;
    username: string;
    password: string;
  }): Promise<ThrowawayUser> {
    const user = await this.createVerifiedUser(input);
    const res = await this.request.patch(this.url(`/admin/users/${user.id}`), {
      headers: await this.adminHeaders(),
      data: { role: 'moderator' },
    });
    await this.data(res);
    return user;
  }

  // ── AI conversations (AF1 / W8) ──────────────────────────────────────────────

  /**
   * Create an AI conversation as `token`'s owner (W8).
   *
   * Exists so a spec can arrange a POPULATED conversation list **without clicking the UI's "New
   * conversation" button**. That matters for the a11y scan: clicking leaves the cursor resting on a
   * `variant="primary"` button, and AntD's derived primary-hover background is #ab6846 — 4.37:1 under
   * white, the same colour W3c-3 pinned for the *default* variant's label and never addressed for the
   * primary variant's background (docs/48 §3.12). The scan's subject is the row, not the create flow
   * (`ai-surfaces.spec.ts` drives that through the real button), so arranging over the API measures
   * what the scan is actually for. This is NOT pointer-parking — nothing is hidden; the button simply
   * is not clicked.
   *
   * `feature` defaults to `writing_assistant`, the one user-facing assistant feature and what the UI
   * sends. Requires the `ai.use` permission, so a 403 here means the PBAC seed-grant defect regressed.
   */
  async createAiConversationAs(
    token: string,
    input: { title?: string; feature?: string } = {},
  ): Promise<{ id: string; title: string | null }> {
    const res = await this.request.post(this.url('/ai/conversations'), {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        feature: input.feature ?? 'writing_assistant',
        ...(input.title === undefined ? {} : { title: input.title }),
      },
    });
    return this.data<{ id: string; title: string | null }>(res);
  }

  // ── Monetization (AF5 / W4) ──────────────────────────────────────────────────

  /**
   * Set the `feature.payments.enabled` master flag (AF5).
   *
   * Pre-seeded **disabled**, so every mutating monetization route answers `MONETIZATION_DISABLED`
   * until this is raised. Resolves the flag by KEY rather than a hard-coded id, because the id is
   * generated per database and this suite runs against seeded and long-lived stacks alike.
   *
   * Returns the previous value so a spec can restore it — the flag is global, and leaving it up would
   * change the starting state every later spec observes.
   */
  async setPaymentsEnabled(enabled: boolean): Promise<boolean> {
    const headers = await this.adminHeaders();
    const listRes = await this.request.get(this.url('/admin/feature-flags'), { headers });
    const flags =
      await this.data<
        Array<{ id: string; key: string; enabled: boolean; rolloutPercentage: number }>
      >(listRes);
    const flag = flags.find((f) => f.key === 'feature.payments.enabled');
    expect(flag, 'feature.payments.enabled is not seeded').toBeTruthy();
    const previous = flag?.enabled === true && flag.rolloutPercentage > 0;
    const res = await this.request.patch(this.url(`/admin/feature-flags/${flag?.id ?? ''}`), {
      headers,
      // Rollout matters as much as the boolean: `evaluateFeatureFlag` treats 0% as off even when
      // `enabled` is true, so setting only the flag would leave the platform dark.
      data: { enabled, rolloutPercentage: enabled ? 100 : 0 },
    });
    await this.data(res);
    return previous;
  }

  // ── AI feature flags (AF1 dark launch, docs/e2e/06 §6) ───────────────────────

  /**
   * Raise the AI master flag plus the named per-feature flags, returning a handle that
   * {@link restoreFeatureFlags} puts back exactly as they were.
   *
   * **Why a per-test toggle rather than a seeded default.** AF1 dark-launches every AI flag
   * (`feature.ai.enabled` and each `feature.ai.<camelCase>.enabled` seed disabled) and that IS the
   * contract every deployment starts from — `assistant.spec.ts` asserts the flag-down surface, so a
   * suite-wide enable would delete that assertion and quietly change what the AI panel's committed
   * visual baselines contain. Same posture as `setPaymentsEnabled`: flip server-side state for the
   * one test that needs it, restore it in `finally`.
   *
   * **The flags are GLOBAL rows**, and the suite runs `fullyParallel`. Any test using this must be
   * pinned to one worker (`test.describe.serial`) alongside anything else that reads the same flags,
   * for the reason the monetization spec documents: a neighbouring test flipping them mid-flight is
   * how this class of race first showed up.
   *
   * Keys are resolved BY KEY, never by id — ids are generated per database and this suite runs
   * against freshly-seeded and long-lived stacks alike.
   */
  async enableAiFeatures(featureFlagKeys: string[]): Promise<FeatureFlagRestore[]> {
    // The master switch is what `AiFeatureService.isAiEnabled` reads; a per-feature flag alone
    // resolves to `off`, not `feature-off`, so raising only one proves nothing.
    return this.setFeatureFlags(['feature.ai.enabled', ...featureFlagKeys], true);
  }

  /** Put flags back to their recorded state (teardown for {@link enableAiFeatures}). */
  async restoreFeatureFlags(previous: FeatureFlagRestore[]): Promise<void> {
    const headers = await this.adminHeaders();
    for (const flag of previous) {
      const res = await this.request.patch(this.url(`/admin/feature-flags/${flag.id}`), {
        headers,
        data: { enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage },
      });
      await this.data(res);
    }
  }

  /** Set several flags at once; returns their previous state in restore order. */
  private async setFeatureFlags(keys: string[], enabled: boolean): Promise<FeatureFlagRestore[]> {
    const headers = await this.adminHeaders();
    const listRes = await this.request.get(this.url('/admin/feature-flags'), { headers });
    const flags = await this.data<FeatureFlagRow[]>(listRes);

    const previous: FeatureFlagRestore[] = [];
    for (const key of keys) {
      const flag = flags.find((f) => f.key === key);
      expect(flag, `${key} is not seeded — the flag catalogue moved`).toBeTruthy();
      if (!flag) continue;
      previous.push({
        id: flag.id,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
      });
      const res = await this.request.patch(this.url(`/admin/feature-flags/${flag.id}`), {
        headers,
        // Rollout matters as much as the boolean: `evaluateFeatureFlag` treats a partial rollout as
        // a per-subject hash and 0% as off, so `enabled: true` alone can still resolve to off.
        data: { enabled, rolloutPercentage: enabled ? 100 : 0 },
      });
      await this.data(res);
    }
    return previous;
  }

  /**
   * Grant an entitlement override (`POST /admin/monetization/overrides`).
   *
   * **This is how the af5 row proves "entitlement granted" end to end.** The payment path cannot: every
   * provider adapter is key-gated and there is no inert or manual adapter, so a checkout on a stack
   * without third-party credentials is refused rather than no-op'd (docs/48 §3.6, W4-4). An override
   * exercises the same Entitlement Service through the same snapshot the client gates on, and it
   * invalidates the server's decision cache on write — so the client sees the change immediately.
   */
  async grantEntitlementOverride(input: {
    userId: string;
    feature: string;
    effect?: 'allow' | 'deny' | 'limited';
    reason?: string;
  }): Promise<{ id: string; feature: string; effect: string }> {
    const res = await this.request.post(this.url('/admin/monetization/overrides'), {
      headers: await this.adminHeaders(),
      data: {
        userId: input.userId,
        feature: input.feature,
        effect: input.effect ?? 'allow',
        source: 'admin',
        reason: input.reason ?? 'e2e entitlement grant',
      },
    });
    return this.data<{ id: string; feature: string; effect: string }>(res);
  }

  /** Revoke an entitlement override (204) — teardown for the grant above. */
  async revokeEntitlementOverride(id: string): Promise<void> {
    const res = await this.request.delete(this.url(`/admin/monetization/overrides/${id}`), {
      headers: await this.adminHeaders(),
    });
    expect(res.ok(), `revoke override ${id} → ${res.status()}`).toBeTruthy();
  }

  /**
   * Subscribe as the bearer of `token`, through the real `POST /monetization/subscription`.
   *
   * Defaults to the `manual` provider, which settles the charge without a processor (`ManualAdapter`,
   * enabled by `PAYMENTS_MANUAL_ENABLED` in this stack). Every real adapter is key-gated and this stack
   * holds no processor credentials, so this is the only provider that can complete a checkout here —
   * see 48 §3.6 W4-4 for why a Stripe test key was rejected in its favour.
   */
  async subscribe(
    token: string,
    input: { tier: string; interval: string; provider?: string; couponCode?: string },
  ): Promise<{
    subscription: { id: string; tier: string; status: string; provider: string };
    checkoutUrl: string | null;
  }> {
    const res = await this.request.post(this.url('/monetization/subscription'), {
      headers: { Authorization: `Bearer ${token}` },
      data: { provider: 'manual', ...input },
    });
    return this.data(res);
  }

  /** The viewer's payment ledger — proves a charge was actually recorded, not just a subscription. */
  async payments(
    token: string,
  ): Promise<Array<{ id: string; provider: string; status: string; amount: number }>> {
    const res = await this.request.get(this.url('/monetization/payments'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    return this.data(res);
  }

  /** The viewer's invoices — the billing document that accompanies the payment. */
  async invoices(
    token: string,
  ): Promise<Array<{ id: string; number: string; status: string; total: number }>> {
    const res = await this.request.get(this.url('/monetization/invoices'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    return this.data(res);
  }

  /** The viewer's own entitlement snapshot — asserts the server side of a gate. */
  async entitlements(token: string): Promise<{
    tier: string;
    features: Array<{ feature: string; allowed: boolean; reason: string }>;
  }> {
    const res = await this.request.get(this.url('/monetization/entitlements'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    return this.data(res);
  }

  // ── Retrieval / AF4 (W5) ─────────────────────────────────────────────────────

  /**
   * Save a search as the seeded writer (`POST /ai/search/saved`).
   *
   * Arranging over REST rather than through the dialog, where the dialog is not the subject: the a11y
   * scan needs a saved ROW to render, and driving the dialog there means closing an animated AntD modal
   * after `expectNoSeriousA11yViolations` has stopped every animation on the page — which never
   * completes ([fixtures/a11y.ts]). The dialog's own behaviour is asserted in `ai-search.spec.ts`.
   *
   * Requires the AF4 flags raised (every route here is gated on them), so call it inside
   * `withAiFeatures`. Idempotent by name on the server.
   */
  async saveAiSearch(input: {
    name: string;
    query: string;
  }): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.url('/ai/search/saved'), {
      headers: await this.writerHeaders(),
      data: input,
    });
    return this.data<{ id: string; name: string }>(res);
  }

  /** Delete a saved search (204) — teardown, so the writer's capped list does not accumulate. */
  async deleteAiSearch(id: string): Promise<void> {
    const res = await this.request.delete(this.url(`/ai/search/saved/${id}`), {
      headers: await this.writerHeaders(),
    });
    expect(res.ok(), `delete saved search ${id} → ${res.status()}`).toBeTruthy();
  }

  // ── Conversation layer / piece comments + responses (W7a, docs/45 §4.4) ──────────────────
  //
  // These are `modules/engagement` PIECE comments — public conversation — not AF6's collaboration
  // comments, which are a story's private review and go through the `/stories/:id/comments` helpers
  // above. Different module, different DTO, different privacy model.

  /**
   * Comment on a piece as the seeded writer (`POST /pieces/:id/comments`).
   *
   * The body is `{ body }` and NOTHING else: `CreateCommentDto` runs under `forbidNonWhitelisted`,
   * so arranging through the exact shape the UI sends means this fixture breaks alongside the UI if
   * the contract ever moves — the M-1 lesson (docs/48 §3.1).
   */
  async commentOnPiece(pieceId: string, body: string): Promise<CommentSummary> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/comments`), {
      headers: await this.writerHeaders(),
      data: { body },
    });
    return this.data<CommentSummary>(res);
  }

  /** Same, as an arbitrary user — for "you cannot edit someone else's comment". */
  async commentOnPieceAs(token: string, pieceId: string, body: string): Promise<CommentSummary> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/comments`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { body },
    });
    return this.data<CommentSummary>(res);
  }

  /**
   * Reply to a comment (`POST /comments/:id/replies`). The parent comes from the URL — the same
   * `CreateCommentDto` as a top-level comment, so a `parentId` in the body would be a 400.
   */
  async replyToComment(commentId: string, body: string): Promise<CommentSummary> {
    const res = await this.request.post(this.url(`/comments/${commentId}/replies`), {
      headers: await this.writerHeaders(),
      data: { body },
    });
    return this.data<CommentSummary>(res);
  }

  /**
   * Soft-delete a comment (`DELETE /comments/:id`, 204) — how the tombstone case is arranged.
   *
   * This is a SOFT delete through the app's own endpoint, which is the only removal the guard rails
   * permit (docs/e2e/09): the node survives, its author goes null, and its replies stay visible.
   */
  async deleteComment(commentId: string): Promise<void> {
    const res = await this.request.delete(this.url(`/comments/${commentId}`), {
      headers: await this.writerHeaders(),
    });
    expect(res.ok(), `delete comment ${commentId} → ${res.status()}`).toBeTruthy();
  }

  /**
   * Write a response to a piece as the seeded writer (`POST /pieces/:id/responses`).
   *
   * Creates a linked DRAFT piece and returns it — the body is `CreatePieceDto`, not a comment DTO,
   * because a response IS a piece. Publishing the returned draft is what makes it appear in the
   * parent's response list (the list is visibility-gated to published, visible pieces).
   */
  async respondToPiece(
    pieceId: string,
    input: { title: string; languageCode?: string },
  ): Promise<PieceSummary> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/responses`), {
      headers: await this.writerHeaders(),
      data: { title: input.title, languageCode: input.languageCode ?? 'en' },
    });
    return this.data<PieceSummary>(res);
  }

  /**
   * Arrange a PUBLISHED response in one call — create the linked draft, give it a genre and a body
   * so it is publishable, then publish it.
   *
   * The two-step exists because `POST /pieces/:id/responses` mints a draft with only a title and a
   * language: `genreSlug` is optional for a draft and required at publish.
   */
  async createPublishedResponse(pieceId: string, title: string): Promise<PieceSummary> {
    const draft = await this.respondToPiece(pieceId, { title });
    const patched = await this.request.patch(this.url(`/pieces/${draft.id}`), {
      headers: await this.writerHeaders(),
      data: {
        genreSlug: 'short-story',
        content: this.tiptapDoc(`${title} — a response seeded by the E2E suite.`),
      },
    });
    await this.data(patched);
    return this.publishPiece(draft.id);
  }

  /**
   * Publish a piece as an arbitrary user (`POST /pieces/:id/publish` as the bearer of `token`).
   *
   * Needed because reporting is the one flow that CANNOT use the shared writer's own content:
   * `POST /reports` refuses a self-report with `422 REPORT_SELF`, so a reportable piece has to
   * belong to somebody else.
   */
  async publishPieceAs(token: string, id: string): Promise<PieceSummary> {
    const res = await this.request.post(this.url(`/pieces/${id}/publish`), {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    return this.data<PieceSummary>(res);
  }

  /** Arrange a published piece owned by someone OTHER than the seeded writer, in one call. */
  async createPublishedPieceAs(token: string, input: { title: string }): Promise<PieceSummary> {
    const draft = await this.createPieceAs(token, input);
    const patched = await this.request.patch(this.url(`/pieces/${draft.id}`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { genreSlug: 'short-story' },
    });
    await this.data(patched);
    return this.publishPieceAs(token, draft.id);
  }

  /**
   * Write a response to a piece as an arbitrary user, published — so the response has an author who
   * is not the viewer, which reporting requires.
   */
  async createPublishedResponseAs(
    token: string,
    pieceId: string,
    title: string,
  ): Promise<PieceSummary> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/responses`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { title, languageCode: 'en' },
    });
    const draft = await this.data<PieceSummary>(res);
    const patched = await this.request.patch(this.url(`/pieces/${draft.id}`), {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        genreSlug: 'short-story',
        content: this.tiptapDoc(`${title} — a response seeded by the E2E suite.`),
      },
    });
    await this.data(patched);
    return this.publishPieceAs(token, draft.id);
  }

  // ── Collections · claps · reports (W7b, docs/45 §4.4) ────────────────────────────────────

  /**
   * Create a collection as the seeded writer (`POST /collections`).
   *
   * Every collections route carries a class-level `@Permissions(collection.manage)` and is scoped to
   * the caller, so there is no public read to arrange against — a collection only exists for the
   * account that made it.
   */
  async createCollection(input: {
    title: string;
    description?: string;
  }): Promise<CollectionSummary> {
    const res = await this.request.post(this.url('/collections'), {
      headers: await this.writerHeaders(),
      data: input,
    });
    return this.data<CollectionSummary>(res);
  }

  /** The seeded writer's collections (`GET /collections`) — for asserting a save landed. */
  async myCollections(): Promise<CollectionSummary[]> {
    const res = await this.request.get(this.url('/collections'), {
      headers: await this.writerHeaders(),
    });
    return this.data<CollectionSummary[]>(res);
  }

  /** Save a piece into a collection (`POST /collections/:id/pieces`). */
  async addPieceToCollection(collectionId: string, pieceId: string): Promise<void> {
    const res = await this.request.post(this.url(`/collections/${collectionId}/pieces`), {
      headers: await this.writerHeaders(),
      data: { pieceId },
    });
    await this.data(res);
  }

  /** A collection's pieces (`GET /collections/:id/pieces`) — the server-side assert for a save. */
  async collectionPieces(collectionId: string): Promise<Array<{ pieceId: string; title: string }>> {
    const res = await this.request.get(this.url(`/collections/${collectionId}/pieces`), {
      headers: await this.writerHeaders(),
    });
    return this.data<Array<{ pieceId: string; title: string }>>(res);
  }

  /** Delete a collection (`DELETE /collections/:id`) — teardown, and never touches the pieces. */
  async deleteCollection(collectionId: string): Promise<void> {
    const res = await this.request.delete(this.url(`/collections/${collectionId}`), {
      headers: await this.writerHeaders(),
    });
    expect(res.ok(), `delete collection ${collectionId} → ${res.status()}`).toBeTruthy();
  }

  /**
   * Add claps as the seeded writer (`POST /pieces/:id/claps`), returning the authoritative
   * `{ viewerClaps, totalClaps }`.
   *
   * The `count` is the whole reason a client can batch a burst into one request, so arranging
   * through it is arranging through the shape the UI actually sends. Used to pre-spend the cap for
   * the "hammering a maxed-out button does nothing" assertion.
   */
  async clapPiece(pieceId: string, count: number): Promise<ClapSummary> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/claps`), {
      headers: await this.writerHeaders(),
      data: { count },
    });
    return this.data<ClapSummary>(res);
  }

  /** This viewer's clap + engagement state (`GET /pieces/:id/engagement`) — public, optional auth. */
  async pieceEngagement(
    pieceId: string,
    token?: string,
  ): Promise<{
    stats: { claps: number; likes: number };
    viewer: { clapCount: number };
  }> {
    const res = await this.request.get(this.url(`/pieces/${pieceId}/engagement`), {
      headers:
        token === undefined ? await this.writerHeaders() : { Authorization: `Bearer ${token}` },
    });
    return this.data(res);
  }

  /**
   * Track a completed read of a piece (`POST /analytics/pieces/:id/read`) — W7c, to arrange REAL
   * reader history for `/me/reading`.
   *
   * Deterministic despite being event-driven: `DomainEventBus.emit` AWAITS its handlers, so
   * `reader_analytics` and `read_event` are both updated by the time this request returns. No
   * polling needed.
   *
   * The defaults clear the server's completion thresholds (`READ_MIN_DWELL_SECONDS` 30 /
   * `READ_MIN_COMPLETION_PCT` 50), so the read counts as COMPLETED. Pass lower values to arrange a
   * read that is counted but not completed.
   */
  async trackRead(
    pieceId: string,
    { durationSeconds = 120, completionPct = 100 } = {},
    token?: string,
  ): Promise<void> {
    const res = await this.request.post(this.url(`/analytics/pieces/${pieceId}/read`), {
      headers:
        token === undefined ? await this.writerHeaders() : { Authorization: `Bearer ${token}` },
      data: { durationSeconds, completionPct },
    });
    expect(res.ok(), `track read → ${res.status()}`).toBeTruthy();
  }

  /** The caller's own reader aggregate (`GET /analytics/readers/me`) — the `/me/reading` source. */
  async readerAnalytics(token?: string): Promise<{
    piecesRead: number;
    readingTimeSeconds: number;
    completedReads: number;
    currentStreak: number;
    longestStreak: number;
    favoriteGenres: Array<{ key: string; label: string; count: number }>;
    favoriteLanguages: Array<{ key: string; label: string; count: number }>;
  }> {
    const res = await this.request.get(this.url('/analytics/readers/me'), {
      headers:
        token === undefined ? await this.writerHeaders() : { Authorization: `Bearer ${token}` },
    });
    return this.data(res);
  }

  /** Bookmark a piece (`POST /pieces/:id/bookmarks`; idempotent) — arranges the bounded count. */
  async bookmarkPiece(pieceId: string, token?: string): Promise<void> {
    const res = await this.request.post(this.url(`/pieces/${pieceId}/bookmarks`), {
      headers:
        token === undefined ? await this.writerHeaders() : { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `bookmark piece → ${res.status()}`).toBeTruthy();
  }

  /** Remove a bookmark (`DELETE /pieces/:id/bookmarks`; idempotent) — teardown for the above. */
  async unbookmarkPiece(pieceId: string, token?: string): Promise<void> {
    const res = await this.request.delete(this.url(`/pieces/${pieceId}/bookmarks`), {
      headers:
        token === undefined ? await this.writerHeaders() : { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `unbookmark piece → ${res.status()}`).toBeTruthy();
  }

  /** Read admin audit-log entries (admin+). Assert an admin action was recorded. */
  async getAuditLogs(params: {
    action?: string;
    targetId?: string;
    limit?: number;
  }): Promise<
    Array<{ action: string; targetId: string | null; actorRole: string; [k: string]: unknown }>
  > {
    const qs = new URLSearchParams();
    if (params.action !== undefined) qs.set('action', params.action);
    if (params.targetId !== undefined) qs.set('targetId', params.targetId);
    qs.set('limit', String(params.limit ?? 20));
    const res = await this.request.get(this.url(`/admin/audit-logs?${qs.toString()}`), {
      headers: await this.adminHeaders(),
    });
    return this.data(res);
  }
}
