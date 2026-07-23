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
}
