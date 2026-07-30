import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import { User } from './entities/user.entity';

/** A whitelisted sort column for the admin grid (SQL is fixed; never user text). */
export interface AdminUserSort {
  column: string;
  direction: 'ASC' | 'DESC';
}

/** Validated filters for the admin user grid (docs 05 §5.2, §6). */
export interface AdminUserFilters {
  search?: string;
  role?: string;
  status?: string;
  verified?: boolean;
  isPrivate?: boolean;
  hasPublished?: boolean;
  registeredFrom?: string;
  registeredTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  includeDeleted?: boolean;
  sort: AdminUserSort;
  page: number;
  offset: number;
  limit: number;
}

/**
 * Denormalized admin read model — one joined row per user (account + profile +
 * effective role), built for the grid and detail views. Purpose-built read
 * model, never the entity (docs 16 §3.2 — no raw-entity leakage).
 */
export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  status: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  penName: string | null;
  avatarKey: string | null;
  isPrivate: boolean | null;
  followersCount: number | null;
  followingCount: number | null;
  piecesCount: number | null;
  role: string;
}

/** Raw projection returned by the joined admin query (before mapping). */
interface AdminUserRawRow {
  id: string;
  email: string;
  username: string;
  status: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  penName: string | null;
  avatarKey: string | null;
  isPrivate: boolean | null;
  followersCount: number | string | null;
  followingCount: number | string | null;
  piecesCount: number | string | null;
  role: string;
}

/**
 * Effective role of `u` (highest granted rank, or the implicit `user`) as a
 * correlated scalar — a constant SQL fragment (no interpolated input), so the
 * grid can filter/return role without an N+1 per row (docs 04 §3.8).
 */
const EFFECTIVE_ROLE_SQL = `COALESCE((SELECT ro.name FROM user_roles ur INNER JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id ORDER BY ro.rank DESC LIMIT 1), 'user')`;

/**
 * Data access for the `users` aggregate (docs 16 §3.3 — only repositories touch
 * TypeORM). Every method accepts an optional `EntityManager` so a service can
 * run it inside a transaction (docs 16 §3.5). Reads exclude soft-deleted rows by
 * default; uniqueness checks include them (a permanent username/email stays
 * claimed, docs 04 §1.5).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<User> {
    return (manager ?? this.dataSource.manager).getRepository(User);
  }

  findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { email } });
  }

  findByUsername(username: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { username } });
  }

  /** Includes soft-deleted rows — a claimed email is never released (docs 04 §1.5). */
  async existsByEmail(email: string, manager?: EntityManager): Promise<boolean> {
    const count = await this.repo(manager).count({ where: { email }, withDeleted: true });
    return count > 0;
  }

  /** Includes soft-deleted rows — a claimed username is permanent (docs 04 §1.5). */
  async existsByUsername(username: string, manager?: EntityManager): Promise<boolean> {
    const count = await this.repo(manager).count({ where: { username }, withDeleted: true });
    return count > 0;
  }

  create(data: Partial<User>, manager?: EntityManager): Promise<User> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async update(id: string, patch: Partial<User>, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, patch);
  }

  // ── Admin read/write surface (E12.5) ──────────────────────────────────────

  /** Finds a user by id **including soft-deleted rows** (admin detail/restore). */
  findByIdWithDeleted(id: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { id }, withDeleted: true });
  }

  /** Soft-deletes an account (sets `deleted_at`); reversible via {@link restore}. */
  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).softDelete({ id });
  }

  /** Clears the soft-delete tombstone, reinstating the account. */
  async restore(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).restore({ id });
  }

  /**
   * The admin user grid (docs 05 §5.2): a filtered, sorted, offset page plus the
   * total. Joins `profiles` (1:1) for name/counts/privacy and derives the
   * effective role via a correlated subquery — one round trip per page, no N+1.
   * Filter values are always bound parameters; only the whitelisted sort column
   * reaches SQL as an identifier (docs 13 §6).
   */
  async adminList(filters: AdminUserFilters): Promise<{ rows: AdminUserRow[]; total: number }> {
    const total = await this.applyAdminFilters(this.baseAdminQuery(filters), filters).getCount();

    const raw = await this.applyAdminSelect(
      this.applyAdminFilters(this.baseAdminQuery(filters), filters),
    )
      .orderBy(filters.sort.column, filters.sort.direction)
      .addOrderBy('u.id', 'DESC')
      .offset(filters.offset)
      .limit(filters.limit)
      .getRawMany<AdminUserRawRow>();

    return { rows: raw.map(toAdminUserRow), total };
  }

  /** A single joined admin row by id (detail view); includes soft-deleted. */
  async adminFindRowById(id: string): Promise<AdminUserRow | null> {
    const raw = await this.applyAdminSelect(
      this.baseAdminQuery({ includeDeleted: true }).andWhere('u.id = :id', { id }),
    ).getRawOne<AdminUserRawRow>();
    return raw === undefined ? null : toAdminUserRow(raw);
  }

  /** Joined admin rows for a set of ids (bulk export of a selection). */
  async adminFindRowsByIds(ids: string[]): Promise<AdminUserRow[]> {
    if (ids.length === 0) {
      return [];
    }
    const raw = await this.applyAdminSelect(
      this.baseAdminQuery({ includeDeleted: true }).andWhere('u.id IN (:...ids)', { ids }),
    ).getRawMany<AdminUserRawRow>();
    return raw.map(toAdminUserRow);
  }

  /** Streams matching admin rows in id-ordered batches for export (no offset drift). */
  async *adminStream(
    filters: Omit<AdminUserFilters, 'offset' | 'limit' | 'sort' | 'page'>,
    batchSize: number,
  ): AsyncGenerator<AdminUserRow[]> {
    let afterId: string | null = null;
    for (;;) {
      const qb = this.applyAdminSelect(
        this.applyAdminFilters(this.baseAdminQuery(filters), filters),
      )
        .orderBy('u.id', 'ASC')
        .limit(batchSize);
      if (afterId !== null) {
        qb.andWhere('u.id > :afterId', { afterId });
      }
      const raw = await qb.getRawMany<AdminUserRawRow>();
      if (raw.length === 0) {
        return;
      }
      yield raw.map(toAdminUserRow);
      if (raw.length < batchSize) {
        return;
      }
      afterId = raw[raw.length - 1]?.id ?? null;
      if (afterId === null) {
        return;
      }
    }
  }

  /** Fresh base query (users ⟕ profiles), soft-delete scope per `includeDeleted`. */
  private baseAdminQuery(filters: { includeDeleted?: boolean }): SelectQueryBuilder<User> {
    const qb = this.repo().createQueryBuilder('u').leftJoin('profiles', 'p', 'p.user_id = u.id');
    if (filters.includeDeleted === true) {
      qb.withDeleted();
    }
    return qb;
  }

  /** Projects the full admin read model (account + profile + effective role). */
  private applyAdminSelect(qb: SelectQueryBuilder<User>): SelectQueryBuilder<User> {
    return qb
      .select('u.id', 'id')
      .addSelect('u.email', 'email')
      .addSelect('u.username', 'username')
      .addSelect('u.status', 'status')
      .addSelect('u.email_verified_at', 'emailVerifiedAt')
      .addSelect('u.last_login_at', 'lastLoginAt')
      .addSelect('u.created_at', 'createdAt')
      .addSelect('u.updated_at', 'updatedAt')
      .addSelect('u.deleted_at', 'deletedAt')
      .addSelect('p.pen_name', 'penName')
      .addSelect('p.avatar_key', 'avatarKey')
      .addSelect('p.is_private', 'isPrivate')
      .addSelect('p.followers_count', 'followersCount')
      .addSelect('p.following_count', 'followingCount')
      .addSelect('p.pieces_count', 'piecesCount')
      .addSelect(EFFECTIVE_ROLE_SQL, 'role');
  }

  /** Applies the admin grid filters to a base query (bound params only). */
  private applyAdminFilters(
    qb: SelectQueryBuilder<User>,
    filters: Partial<AdminUserFilters>,
  ): SelectQueryBuilder<User> {
    if (filters.search !== undefined && filters.search.length > 0) {
      const like = `%${filters.search}%`;
      qb.andWhere(
        '(u.username ILIKE :like OR u.email ILIKE :like OR p.pen_name ILIKE :like OR u.id::text = :exact)',
        { like, exact: filters.search },
      );
    }
    if (filters.role !== undefined) {
      qb.andWhere(`${EFFECTIVE_ROLE_SQL} = :role`, { role: filters.role });
    }
    if (filters.status !== undefined) {
      qb.andWhere('u.status = :status', { status: filters.status });
    }
    if (filters.verified !== undefined) {
      qb.andWhere(
        filters.verified ? 'u.email_verified_at IS NOT NULL' : 'u.email_verified_at IS NULL',
      );
    }
    if (filters.isPrivate !== undefined) {
      qb.andWhere('p.is_private = :isPrivate', { isPrivate: filters.isPrivate });
    }
    if (filters.hasPublished !== undefined) {
      qb.andWhere(filters.hasPublished ? 'p.pieces_count > 0' : 'COALESCE(p.pieces_count, 0) = 0');
    }
    if (filters.registeredFrom !== undefined) {
      qb.andWhere('u.created_at >= :registeredFrom', { registeredFrom: filters.registeredFrom });
    }
    if (filters.registeredTo !== undefined) {
      qb.andWhere('u.created_at <= :registeredTo', { registeredTo: filters.registeredTo });
    }
    if (filters.lastLoginFrom !== undefined) {
      qb.andWhere('u.last_login_at >= :lastLoginFrom', { lastLoginFrom: filters.lastLoginFrom });
    }
    if (filters.lastLoginTo !== undefined) {
      qb.andWhere('u.last_login_at <= :lastLoginTo', { lastLoginTo: filters.lastLoginTo });
    }
    return qb;
  }
}

/** Coerces a raw joined row into the typed admin read model. */
function toAdminUserRow(raw: AdminUserRawRow): AdminUserRow {
  const toNumber = (value: number | string | null): number | null =>
    value === null ? null : Number(value);
  return {
    id: raw.id,
    email: raw.email,
    username: raw.username,
    status: raw.status,
    emailVerifiedAt: raw.emailVerifiedAt,
    lastLoginAt: raw.lastLoginAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    deletedAt: raw.deletedAt,
    penName: raw.penName,
    avatarKey: raw.avatarKey,
    isPrivate: raw.isPrivate,
    followersCount: toNumber(raw.followersCount),
    followingCount: toNumber(raw.followingCount),
    piecesCount: toNumber(raw.piecesCount),
    role: raw.role,
  };
}
