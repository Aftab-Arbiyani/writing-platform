import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  NotificationEntityType,
  NotificationType,
  RestrictionScope,
  RestrictionType,
  STRIKE_RESTRICTION_THRESHOLD,
  STRIKE_SUSPENSION_THRESHOLD,
  STRIKE_WEIGHTS,
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  TrustStatus,
  trustLevelForScore,
  trustStatusForRestriction,
  type Role,
} from '@qalam/shared';

import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications';
import { PolicyEngineService } from '../policy';
import type { TrustContext } from '../policy';
import type { User } from '../users/entities/user.entity';
import { UserNotFoundException } from '../users/exceptions/users.exceptions';
import { UsersService } from '../users/users.service';

import type { ApplyRestrictionDto, IssueStrikeDto } from './dto/trust-request.dto';
import type {
  BlockDto,
  RestrictionDto,
  StrikeDto,
  TrustSummaryDto,
} from './dto/trust-response.dto';
import { TrustProfile } from './entities/trust-profile.entity';
import type { UserRestriction } from './entities/user-restriction.entity';
import { toBlockDto, toRestrictionDto, toStrikeDto } from './trust.mappers';
import {
  BLOCK_KIND,
  TRUST_AUDIT_ACTIONS,
  TRUST_AUDIT_TARGET,
  type BlockKind,
} from './trust.constants';
import {
  BlockNotFoundException,
  BlockSelfException,
  RestrictionNotFoundException,
  StrikeAlreadyRevokedException,
  StrikeNotFoundException,
} from './trust.exceptions';
import { TrustRepository } from './trust.repository';

/** How much a single strike's weight lowers the reputation score. */
const SCORE_PENALTY_PER_WEIGHT = 5;

/** Score at/above which a user is `trusted`; below `LIMITED` they are `limited`. */
const TRUSTED_SCORE = 80;
const LIMITED_SCORE = 25;

/**
 * Severity ordering for trust statuses — used to pick the single most severe
 * status when multiple restrictions are active. Higher = more restrictive.
 */
const STATUS_SEVERITY: Record<TrustStatus, number> = {
  [TrustStatus.Banned]: 7,
  [TrustStatus.Suspended]: 6,
  [TrustStatus.Shadowed]: 5,
  [TrustStatus.ReadOnly]: 4,
  [TrustStatus.Muted]: 3,
  [TrustStatus.Limited]: 2,
  [TrustStatus.Normal]: 1,
  [TrustStatus.Trusted]: 0,
};

/** The moderator/admin performing a write, plus request context for the trail. */
export interface TrustActor {
  id: string;
  role: Role;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Trust & Safety (AF6) — the reputation, strikes, restrictions, and personal
 * block/mute platform. It owns its four tables (via {@link TrustRepository}),
 * records every standing change through the shared {@link AuditService}, and —
 * critically — invalidates the {@link PolicyEngineService} decision cache after
 * ANY change to a user's standing so a cached "allowed" can never outlive the
 * strike/restriction/block that should now deny it. It is the data source behind
 * the engine's Trust port (see {@link TrustStatusService}); it never re-derives
 * authorization itself.
 */
@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    private readonly repository: TrustRepository,
    private readonly audit: AuditService,
    private readonly engine: PolicyEngineService,
    // Read-only, and for one question: does this id belong to a real account (A2-4).
    // `UsersModule` does not import `TrustModule`, so this direction adds no cycle.
    private readonly users: UsersService,
    // Best-effort: the Trust module wires NotificationsModule, but unit tests
    // construct without it and simply skip delivery.
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Profile / summary ─────────────────────────────────────────────────────────

  /**
   * Loads a user's trust profile, creating a default one on first touch.
   *
   * Called from the WRITE paths only ({@link issueStrike}), which is where a row
   * earns its existence. Reads must never reach this — see {@link getSummary}.
   */
  async getOrCreateProfile(userId: string): Promise<TrustProfile> {
    const existing = await this.repository.findProfile(userId);
    if (existing !== null) {
      return existing;
    }
    const profile = new TrustProfile();
    profile.userId = userId;
    profile.score = TRUST_SCORE_DEFAULT;
    profile.level = trustLevelForScore(TRUST_SCORE_DEFAULT);
    profile.activeStrikeWeight = 0;
    return this.repository.saveProfile(profile);
  }

  /**
   * The trust summary shown on the account/admin screens.
   *
   * **A GET writes nothing (A2-4).** This used to call `getOrCreateProfile`, so
   * every read of a user who had never been struck INSERTED a `trust_profiles`
   * row — and since `trust_profiles` has no FK to `users` (deliberately: the trail
   * must outlive a hard-deleted account), a mistyped UUID minted a row for an
   * account that does not exist. The defaults are now derived in memory exactly as
   * {@link resolveTrustContext} already derived them, so a user with no profile
   * reads the same standing they always did without one being manufactured. The
   * row is created by the first write instead, which is when it means something.
   */
  async getSummary(userId: string): Promise<TrustSummaryDto> {
    const [profile, restrictions] = await Promise.all([
      this.repository.findProfile(userId),
      this.repository.listActiveRestrictions(userId),
    ]);
    const score = profile?.score ?? TRUST_SCORE_DEFAULT;
    return {
      score,
      level: profile?.level ?? trustLevelForScore(TRUST_SCORE_DEFAULT),
      status: this.computeStatus(score, restrictions),
      activeStrikeWeight: profile?.activeStrikeWeight ?? 0,
      restrictions: restrictions.map(toRestrictionDto),
    };
  }

  /**
   * The admin/moderator read of someone ELSE's standing — the same summary, but it
   * first proves the account exists (A2-4, second half).
   *
   * `GET /admin/users/:id/trust` answered a clean standing for any well-formed
   * UUID, so a mistyped id was indistinguishable from a real account with a spotless
   * record — and an operator could go on to strike it. The self read (`me/trust`)
   * needs no such check: its id comes from the JWT.
   *
   * This 404s where B8-1 (docs/48 §3) chose a nullable shape on the monetization
   * per-account reads. That divergence is deliberate and recorded in §6.17: those
   * reads only return an ambiguous empty, while this one used to WRITE. A 404 is the
   * answer B8-1 should adopt when its own row comes up, not a second convention.
   */
  async inspectSummary(userId: string): Promise<TrustSummaryDto> {
    const user = await this.requireUser(userId);
    const summary = await this.getSummary(userId);
    // The account's own status travels with the standing (A2-1, display half). Without
    // it the Trust tab renders "Good standing" for an account an operator suspended
    // ten minutes ago, because a suspension writes no trust restriction — and an
    // operator reading a clean trust record beside a suspend button is being invited
    // to make the wrong call.
    return { ...summary, accountStatus: user.status };
  }

  /**
   * Resolves a user's trust standing for the Policy Engine (hot path — called on
   * every evaluation via the Trust port, so it READS only, never creating a row).
   */
  async resolveTrustContext(userId: string): Promise<TrustContext> {
    const [profile, restrictions] = await Promise.all([
      this.repository.findProfile(userId),
      this.repository.listActiveRestrictions(userId),
    ]);
    const score = profile?.score ?? TRUST_SCORE_DEFAULT;
    return {
      status: this.computeStatus(score, restrictions),
      level: trustLevelForScore(score),
      restrictions: restrictions.map((r) => ({ type: r.type, scope: r.scope })),
    };
  }

  /** Whether an interaction between two users is blocked either way (Trust port). */
  isInteractionBlocked(a: string, b: string): Promise<boolean> {
    return this.repository.isBlockedEitherWay(a, b);
  }

  // ── Strikes ──────────────────────────────────────────────────────────────────

  /**
   * Issues a strike: snapshots the weight, recomputes the active-strike total and
   * reputation score, auto-applies a restriction/suspension when the total crosses
   * a threshold (idempotent), audits, invalidates the policy cache, and notifies.
   */
  async issueStrike(userId: string, dto: IssueStrikeDto, actor: TrustActor): Promise<StrikeDto> {
    const weight = STRIKE_WEIGHTS[dto.severity] ?? 0;
    const profile = await this.getOrCreateProfile(userId);

    const strike = await this.repository.createStrike({
      userId,
      severity: dto.severity,
      reason: dto.reason,
      weight,
      reportId: dto.reportId ?? null,
      issuedById: actor.id,
      expiresAt: dto.expiresAt !== undefined ? new Date(dto.expiresAt) : null,
    });

    // Recompute from the source of truth rather than incrementing a counter that
    // could drift (revocations/expiries happen out of band).
    const totalWeight = await this.repository.sumActiveStrikeWeight(userId);
    profile.activeStrikeWeight = totalWeight;
    profile.score = this.clampScore(profile.score - weight * SCORE_PENALTY_PER_WEIGHT);
    profile.level = trustLevelForScore(profile.score);
    await this.repository.saveProfile(profile);

    await this.maybeEscalate(userId, totalWeight, actor);

    await this.record(actor, TRUST_AUDIT_ACTIONS.StrikeIssue, userId, TRUST_AUDIT_TARGET.User, {
      strikeId: strike.id,
      severity: dto.severity,
      weight,
      totalWeight,
      reportId: strike.reportId,
    });
    this.engine.invalidateUser(userId);
    this.notify(userId, NotificationType.TrustWarning, {
      severity: dto.severity,
      reason: dto.reason,
      totalWeight,
    });
    return toStrikeDto(strike);
  }

  /**
   * Every strike on a user (active + revoked + expired), newest first — B9's read
   * half of A2-2.
   *
   * Strikes were write-only: `POST users/:id/strikes` existed and nothing could read
   * one back, so the admin surface had to PROJECT what a strike would do
   * (`escalationCopy`) instead of stating what the account already carries. The
   * revoked and expired rows travel too: `activeStrikeWeight` counts only the live
   * ones, so a list of live strikes alone could never explain a weight an operator
   * disagrees with.
   */
  async listStrikes(userId: string): Promise<StrikeDto[]> {
    await this.assertUserExists(userId);
    const rows = await this.repository.listStrikesForUser(userId);
    return rows.map(toStrikeDto);
  }

  /**
   * Revokes a strike — B9's write half of A2-2, and the answer to A2-3.
   *
   * **This is the only thing that reduces a user's active strike weight**, and that
   * is deliberate. Lifting a restriction says "you may act again"; revoking a strike
   * says "that strike should not have been issued". Lifting an auto-applied
   * suspension therefore leaves the weight at or over the threshold, so the next
   * strike of ANY severity re-applies it (`maybeEscalate` → `ensureGlobalRestriction`).
   * That is not a bug once a revoke route exists — it is the two remedies staying
   * distinct — but it IS invisible, so the admin surface says it out loud and this
   * comment is here for the next reader who rediscovers it.
   *
   * The weight is recomputed from the strike rows, never decremented, for the reason
   * {@link issueStrike} gives. The score is recomputed from the SAME ledger rather
   * than having the weight added back, because `issueStrike` clamps at
   * `TRUST_SCORE_MIN`: a strike that drove the score to 0 removed less than its full
   * penalty, and adding the penalty back would hand out points the strike never took.
   */
  async revokeStrike(strikeId: string, actor: TrustActor): Promise<StrikeDto> {
    const strike = await this.repository.findStrike(strikeId);
    if (strike === null) {
      throw new StrikeNotFoundException();
    }
    if (strike.revokedAt !== null) {
      throw new StrikeAlreadyRevokedException();
    }
    await this.repository.revokeStrike(strikeId);
    strike.revokedAt = new Date();

    const userId = strike.userId;
    const totalWeight = await this.repository.sumActiveStrikeWeight(userId);
    const profile = await this.getOrCreateProfile(userId);
    profile.activeStrikeWeight = totalWeight;
    profile.score = this.clampScore(TRUST_SCORE_DEFAULT - totalWeight * SCORE_PENALTY_PER_WEIGHT);
    profile.level = trustLevelForScore(profile.score);
    await this.repository.saveProfile(profile);

    await this.record(actor, TRUST_AUDIT_ACTIONS.StrikeRevoke, strikeId, TRUST_AUDIT_TARGET.User, {
      userId,
      severity: strike.severity,
      weight: strike.weight,
      totalWeight,
    });
    // A revoke can only ever WIDEN what the user may do, so a cached deny must go —
    // the same reason every other standing change invalidates here and not in the
    // controller. Any auto-applied restriction stays in force until it is lifted:
    // dropping the weight below the threshold does not undo a sanction an operator
    // may have separately confirmed.
    this.engine.invalidateUser(userId);
    this.notify(userId, NotificationType.TrustWarning, {
      revoked: true,
      severity: strike.severity,
      totalWeight,
    });
    return toStrikeDto(strike);
  }

  // ── Restrictions ────────────────────────────────────────────────────────────

  /** Applies a manual account restriction (moderator action). */
  async applyRestriction(
    userId: string,
    dto: ApplyRestrictionDto,
    actor: TrustActor,
  ): Promise<RestrictionDto> {
    const restriction = await this.repository.createRestriction({
      userId,
      type: dto.type,
      scope: dto.scope,
      reason: dto.reason,
      issuedById: actor.id,
      expiresAt: dto.expiresAt !== undefined ? new Date(dto.expiresAt) : null,
    });
    await this.record(
      actor,
      TRUST_AUDIT_ACTIONS.RestrictionApply,
      restriction.id,
      TRUST_AUDIT_TARGET.Restriction,
      { userId, type: dto.type, scope: dto.scope, auto: false },
    );
    this.engine.invalidateUser(userId);
    this.notify(userId, NotificationType.RestrictionApplied, {
      type: dto.type,
      scope: dto.scope,
      reason: dto.reason,
    });
    return toRestrictionDto(restriction);
  }

  /**
   * Lifts an active restriction. 404 when the restriction does not exist.
   *
   * **Lifting does NOT reduce the active strike weight, and that is the design
   * (A2-3).** If the restriction was applied automatically by {@link maybeEscalate},
   * the weight that earned it is still on the account, so the next strike of any
   * severity re-crosses the threshold and re-applies it. The remedy for a weight an
   * operator disagrees with is {@link revokeStrike} — "that strike was wrong" — not a
   * lift, which only ever means "you may act again". Two different intents, kept
   * apart. The admin surface states the consequence at the lift, because an operator
   * who lifts a suspension and watches it come back on the next minor strike would
   * otherwise have no way to learn why.
   */
  async liftRestriction(id: string, actor: TrustActor): Promise<RestrictionDto> {
    const restriction = await this.repository.findRestriction(id);
    if (restriction === null) {
      throw new RestrictionNotFoundException();
    }
    await this.repository.liftRestriction(id);
    restriction.liftedAt = new Date();
    await this.record(
      actor,
      TRUST_AUDIT_ACTIONS.RestrictionLift,
      id,
      TRUST_AUDIT_TARGET.Restriction,
      { userId: restriction.userId, type: restriction.type },
    );
    this.engine.invalidateUser(restriction.userId);
    return toRestrictionDto(restriction);
  }

  /**
   * Every restriction for a user (active + historical). Admin-only, so it proves the
   * account exists first — an empty list for a mistyped id would read as a clean
   * record (A2-4).
   */
  async listRestrictions(userId: string): Promise<RestrictionDto[]> {
    await this.assertUserExists(userId);
    const rows = await this.repository.listRestrictionsForUser(userId);
    return rows.map(toRestrictionDto);
  }

  // ── Blocks / mutes (self-service) ──────────────────────────────────────────────

  block(blockerId: string, targetId: string): Promise<BlockDto> {
    return this.createEdge(blockerId, targetId, BLOCK_KIND.Block);
  }

  unblock(blockerId: string, targetId: string): Promise<void> {
    return this.removeEdge(blockerId, targetId, BLOCK_KIND.Block);
  }

  mute(blockerId: string, targetId: string): Promise<BlockDto> {
    return this.createEdge(blockerId, targetId, BLOCK_KIND.Mute);
  }

  unmute(blockerId: string, targetId: string): Promise<void> {
    return this.removeEdge(blockerId, targetId, BLOCK_KIND.Mute);
  }

  /** All edges (blocks + mutes) the user has created. */
  async listBlocks(userId: string): Promise<BlockDto[]> {
    const rows = await this.repository.listBlocks(userId);
    return rows.map(toBlockDto);
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async createEdge(
    blockerId: string,
    targetId: string,
    kind: BlockKind,
  ): Promise<BlockDto> {
    if (blockerId === targetId) {
      throw new BlockSelfException();
    }
    // Idempotent: re-blocking returns the existing edge (unique index-safe).
    const existing = await this.repository.findBlock(blockerId, targetId, kind);
    const block =
      existing ?? (await this.repository.createBlock({ blockerId, blockedId: targetId, kind }));
    // A block is bidirectional (isBlockedEitherWay), so BOTH parties' cached
    // interaction decisions must clear — otherwise the target could act on the
    // blocker until their TTL expires.
    this.engine.invalidateUser(blockerId);
    this.engine.invalidateUser(targetId);
    return toBlockDto(block);
  }

  private async removeEdge(blockerId: string, targetId: string, kind: BlockKind): Promise<void> {
    const existing = await this.repository.findBlock(blockerId, targetId, kind);
    if (existing === null) {
      throw new BlockNotFoundException();
    }
    await this.repository.deleteBlock(blockerId, targetId, kind);
    this.engine.invalidateUser(blockerId);
    this.engine.invalidateUser(targetId);
  }

  /** Auto-applies the strongest restriction the current strike total earns (idempotent). */
  private async maybeEscalate(
    userId: string,
    totalWeight: number,
    actor: TrustActor,
  ): Promise<void> {
    if (totalWeight >= STRIKE_SUSPENSION_THRESHOLD) {
      await this.ensureGlobalRestriction(
        userId,
        RestrictionType.Suspended,
        actor,
        'Automatic suspension: active-strike threshold reached.',
      );
    } else if (totalWeight >= STRIKE_RESTRICTION_THRESHOLD) {
      await this.ensureGlobalRestriction(
        userId,
        RestrictionType.Restricted,
        actor,
        'Automatic restriction: active-strike threshold reached.',
      );
    }
  }

  /** Applies a global restriction of `type` unless one is already active (no stacking). */
  private async ensureGlobalRestriction(
    userId: string,
    type: RestrictionType,
    actor: TrustActor,
    reason: string,
  ): Promise<void> {
    const active = await this.repository.listActiveRestrictions(userId);
    if (active.some((r) => r.type === type && r.scope === RestrictionScope.Global)) {
      return;
    }
    const restriction = await this.repository.createRestriction({
      userId,
      type,
      scope: RestrictionScope.Global,
      reason,
      issuedById: actor.id,
      expiresAt: null,
    });
    await this.record(
      actor,
      TRUST_AUDIT_ACTIONS.RestrictionApply,
      restriction.id,
      TRUST_AUDIT_TARGET.Restriction,
      { userId, type, scope: RestrictionScope.Global, auto: true },
    );
    this.notify(userId, NotificationType.RestrictionApplied, {
      type,
      scope: RestrictionScope.Global,
      reason,
    });
  }

  /**
   * Derives the trust status: an active `suspended` restriction wins; else the
   * single most severe active restriction maps via `trustStatusForRestriction`;
   * else the score decides (`trusted` ≥ 80, `limited` < 25, otherwise `normal`).
   */
  private computeStatus(score: number, restrictions: readonly UserRestriction[]): TrustStatus {
    if (restrictions.some((r) => r.type === RestrictionType.Suspended)) {
      return TrustStatus.Suspended;
    }
    if (restrictions.length > 0) {
      let worst: TrustStatus = TrustStatus.Normal;
      for (const restriction of restrictions) {
        const status = trustStatusForRestriction(restriction.type);
        if (STATUS_SEVERITY[status] > STATUS_SEVERITY[worst]) {
          worst = status;
        }
      }
      return worst;
    }
    if (score >= TRUSTED_SCORE) {
      return TrustStatus.Trusted;
    }
    if (score < LIMITED_SCORE) {
      return TrustStatus.Limited;
    }
    return TrustStatus.Normal;
  }

  private clampScore(score: number): number {
    return Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, Math.round(score)));
  }

  /**
   * 404s an id that belongs to nobody (A2-4). Guards the three admin reads and the
   * revoke, not the self-service paths whose id comes from the JWT.
   *
   * `trust_profiles` has no FK to `users` on purpose — the trail must outlive a
   * hard-deleted account — so this is the only place the two can be reconciled, and
   * it reads `users` rather than `trust_profiles` because "has no trust profile" and
   * "is not a user" are different answers.
   */
  private async assertUserExists(userId: string): Promise<void> {
    await this.requireUser(userId);
  }

  /** As {@link assertUserExists}, but hands back the row when the caller needs a field. */
  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new UserNotFoundException();
    }
    return user;
  }

  private async record(
    actor: TrustActor,
    action: string,
    targetId: string | null,
    targetType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId,
      targetType,
      metadata,
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
  }

  /**
   * AF6 seam — best-effort notification through the engine's single write path.
   * Fire-and-forget: it never blocks or fails the standing change (a notification
   * outage must not roll back a strike). Errors are logged, not propagated.
   */
  private notify(recipientId: string, type: NotificationType, data: Record<string, unknown>): void {
    if (this.notifications === undefined) {
      return;
    }
    void this.notifications
      .create({
        recipientId,
        type,
        entityType: NotificationEntityType.User,
        entityId: recipientId,
        data,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `trust notification (${type}) failed for ${recipientId}: ${(error as Error).message}`,
        );
      });
  }
}
