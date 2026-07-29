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

export interface PieceSummary {
  readonly id: string;
  readonly slug: string | null;
  readonly title: string | null;
  readonly status: 'draft' | 'scheduled' | 'published' | 'archived';
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
   */
  async createPiece(input: {
    title: string;
    genreSlug?: string;
    languageCode?: string;
    body?: string;
  }): Promise<PieceSummary> {
    const res = await this.request.post(this.url('/pieces'), {
      headers: await this.writerHeaders(),
      data: {
        title: input.title,
        genreSlug: input.genreSlug ?? 'short-story',
        languageCode: input.languageCode ?? 'en',
        content: this.tiptapDoc(input.body ?? `${input.title} — seeded by the E2E suite.`),
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
  }): Promise<PieceSummary> {
    const draft = await this.createPiece(input);
    return this.publishPiece(draft.id);
  }

  /** Log in and return just the access token (for arranging actions as an arbitrary user). */
  async loginToken(email: string, password: string): Promise<string> {
    return (await this.login(email, password)).accessToken;
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

  /** A story's snapshots as the seeded writer (GET /stories/:id/snapshots). */
  async storySnapshots(
    storyId: string,
  ): Promise<{ id: string; version: number; reason: string }[]> {
    const res = await this.request.get(this.url(`/stories/${storyId}/snapshots`), {
      headers: await this.writerHeaders(),
    });
    return this.data<{ id: string; version: number; reason: string }[]>(res);
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
