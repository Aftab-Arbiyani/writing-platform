import { Injectable } from '@nestjs/common';
import type { RestrictionScope, RestrictionType, StrikeSeverity } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';

import { TrustProfile } from './entities/trust-profile.entity';
import { UserBlock } from './entities/user-block.entity';
import { UserRestriction } from './entities/user-restriction.entity';
import { UserStrike } from './entities/user-strike.entity';
import { BLOCK_KIND, type BlockKind } from './trust.constants';

/** A new strike row (ids/timestamps assigned by the entity on insert). */
export interface NewStrike {
  userId: string;
  severity: StrikeSeverity;
  reason: string;
  weight: number;
  reportId: string | null;
  issuedById: string;
  expiresAt: Date | null;
}

/** A new restriction row. */
export interface NewRestriction {
  userId: string;
  type: RestrictionType;
  scope: RestrictionScope;
  reason: string;
  issuedById: string;
  expiresAt: Date | null;
}

/** A new block/mute edge. */
export interface NewBlock {
  blockerId: string;
  blockedId: string;
  kind: BlockKind;
}

/**
 * Data access for the Trust & Safety aggregates (`trust_profiles`,
 * `user_strikes`, `user_restrictions`, `user_blocks`). The ONLY layer that builds
 * query builders (docs 16 §3.3) — mirrors `AuditRepository` (DataSource-injected,
 * a per-entity repository accessor). "Active" is a first-class concept: a strike
 * or restriction counts only while not revoked/lifted AND not expired, evaluated
 * in SQL against `now()` so the boundary is the DB clock, never the app's.
 */
@Injectable()
export class TrustRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get profiles(): Repository<TrustProfile> {
    return this.dataSource.getRepository(TrustProfile);
  }

  private get strikes(): Repository<UserStrike> {
    return this.dataSource.getRepository(UserStrike);
  }

  private get restrictions(): Repository<UserRestriction> {
    return this.dataSource.getRepository(UserRestriction);
  }

  private get blocks(): Repository<UserBlock> {
    return this.dataSource.getRepository(UserBlock);
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  findProfile(userId: string): Promise<TrustProfile | null> {
    return this.profiles.findOne({ where: { userId } });
  }

  saveProfile(profile: TrustProfile): Promise<TrustProfile> {
    return this.profiles.save(profile);
  }

  // ── Strikes ──────────────────────────────────────────────────────────────────

  /** Currently-active strikes (not revoked, not expired), newest first. */
  listActiveStrikes(userId: string): Promise<UserStrike[]> {
    return this.strikes
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.revoked_at IS NULL')
      .andWhere('(s.expires_at IS NULL OR s.expires_at > now())')
      .orderBy('s.created_at', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .getMany();
  }

  /** Summed weight of currently-active strikes (0 when none). */
  async sumActiveStrikeWeight(userId: string): Promise<number> {
    const row = await this.strikes
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.weight), 0)', 'total')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.revoked_at IS NULL')
      .andWhere('(s.expires_at IS NULL OR s.expires_at > now())')
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /**
   * Every strike for a user (active + revoked + expired), newest first — the
   * operator read added by B9 (A2-2). Mirrors {@link listRestrictionsForUser}: the
   * caller decides what each row currently IS, because a revoked or expired strike
   * still has to be visible or the history is a lie by omission.
   */
  listStrikesForUser(userId: string): Promise<UserStrike[]> {
    return this.strikes
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .orderBy('s.created_at', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .getMany();
  }

  findStrike(id: string): Promise<UserStrike | null> {
    return this.strikes.findOne({ where: { id } });
  }

  createStrike(input: NewStrike): Promise<UserStrike> {
    return this.strikes.save(this.strikes.create(input));
  }

  async revokeStrike(id: string): Promise<void> {
    await this.strikes.update({ id }, { revokedAt: new Date() });
  }

  // ── Restrictions ─────────────────────────────────────────────────────────────

  /** Currently-active restrictions (not lifted, not expired), newest first. */
  listActiveRestrictions(userId: string): Promise<UserRestriction[]> {
    return this.restrictions
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.lifted_at IS NULL')
      .andWhere('(r.expires_at IS NULL OR r.expires_at > now())')
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getMany();
  }

  createRestriction(input: NewRestriction): Promise<UserRestriction> {
    return this.restrictions.save(this.restrictions.create(input));
  }

  findRestriction(id: string): Promise<UserRestriction | null> {
    return this.restrictions.findOne({ where: { id } });
  }

  async liftRestriction(id: string): Promise<void> {
    await this.restrictions.update({ id }, { liftedAt: new Date() });
  }

  /** Every restriction for a user (active + historical), newest first. */
  listRestrictionsForUser(userId: string): Promise<UserRestriction[]> {
    return this.restrictions
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getMany();
  }

  // ── Blocks / mutes ────────────────────────────────────────────────────────────

  findBlock(blockerId: string, blockedId: string, kind: BlockKind): Promise<UserBlock | null> {
    return this.blocks.findOne({ where: { blockerId, blockedId, kind } });
  }

  createBlock(input: NewBlock): Promise<UserBlock> {
    return this.blocks.save(this.blocks.create(input));
  }

  async deleteBlock(blockerId: string, blockedId: string, kind: BlockKind): Promise<void> {
    await this.blocks.delete({ blockerId, blockedId, kind });
  }

  /** True when a `block` edge exists between the two users in EITHER direction. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const count = await this.blocks
      .createQueryBuilder('b')
      .where('b.kind = :kind', { kind: BLOCK_KIND.Block })
      .andWhere(
        '((b.blocker_id = :a AND b.blocked_id = :b) OR (b.blocker_id = :b AND b.blocked_id = :a))',
        { a, b },
      )
      .getCount();
    return count > 0;
  }

  /** All edges (blocks + mutes) authored by a user, newest first. */
  listBlocks(blockerId: string): Promise<UserBlock[]> {
    return this.blocks
      .createQueryBuilder('b')
      .where('b.blocker_id = :blockerId', { blockerId })
      .orderBy('b.created_at', 'DESC')
      .addOrderBy('b.id', 'DESC')
      .getMany();
  }
}
