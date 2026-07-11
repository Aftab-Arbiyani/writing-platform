import { Role, UserStatus } from '@qalam/shared';

import type { AdminUserRow } from '../users/users.repository';
import type { AdminUserListQueryDto } from './dto/admin-user-query.dto';
import {
  parseSort,
  projectFields,
  toAdminUserFilters,
  toExportRow,
  toListItem,
} from './admin-user.mapper';

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: '0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11',
    email: 'meera@example.com',
    username: 'meera_k',
    status: UserStatus.Active,
    emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
    lastLoginAt: new Date('2026-07-09T18:30:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
    penName: 'Meera',
    avatarKey: 'avatars/x.webp',
    isPrivate: false,
    followersCount: 12,
    followingCount: 4,
    piecesCount: 7,
    role: Role.User,
    ...overrides,
  };
}

describe('parseSort', () => {
  it('defaults to newest-first when no token is given', () => {
    expect(parseSort(undefined)).toEqual({ column: 'u.created_at', direction: 'DESC' });
  });

  it('maps a descending token', () => {
    expect(parseSort('-username')).toEqual({ column: 'u.username', direction: 'DESC' });
  });

  it('maps an ascending profile-column token', () => {
    expect(parseSort('followers')).toEqual({ column: 'p.followers_count', direction: 'ASC' });
  });
});

describe('toAdminUserFilters', () => {
  it('coerces the string filters into typed repository filters', () => {
    const query = {
      page: 2,
      limit: 25,
      offset: 25,
      q: 'meera',
      role: Role.Admin,
      status: UserStatus.Suspended,
      verified: 'true',
      visibility: 'private',
      hasPublished: 'false',
      includeDeleted: 'true',
      sort: '-lastLoginAt',
      registeredFrom: '2026-01-01',
    } as unknown as AdminUserListQueryDto;

    expect(toAdminUserFilters(query)).toEqual({
      search: 'meera',
      role: Role.Admin,
      status: UserStatus.Suspended,
      verified: true,
      isPrivate: true,
      hasPublished: false,
      registeredFrom: '2026-01-01',
      registeredTo: undefined,
      lastLoginFrom: undefined,
      lastLoginTo: undefined,
      includeDeleted: true,
      sort: { column: 'u.last_login_at', direction: 'DESC' },
      page: 2,
      offset: 25,
      limit: 25,
    });
  });

  it('leaves boolean filters undefined when absent and defaults includeDeleted false', () => {
    const query = { page: 1, limit: 20, offset: 0 } as unknown as AdminUserListQueryDto;
    const filters = toAdminUserFilters(query);
    expect(filters.verified).toBeUndefined();
    expect(filters.isPrivate).toBeUndefined();
    expect(filters.includeDeleted).toBe(false);
  });
});

describe('toListItem', () => {
  it('maps a row and folds in the resolved draft count', () => {
    const item = toListItem(row(), 3);
    expect(item).toMatchObject({
      id: '0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11',
      username: 'meera_k',
      displayName: 'Meera',
      role: 'user',
      status: 'active',
      verified: true,
      isPrivate: false,
      followers: 12,
      following: 4,
      publishedPieces: 7,
      draftCount: 3,
    });
    // last activity is honestly approximated by last login
    expect(item.lastActiveAt).toBe(item.lastLoginAt);
  });

  it('treats a null verification timestamp as unverified and null counts as zero', () => {
    const item = toListItem(
      row({ emailVerifiedAt: null, followersCount: null, isPrivate: null }),
      0,
    );
    expect(item.verified).toBe(false);
    expect(item.followers).toBe(0);
    expect(item.isPrivate).toBe(false);
  });
});

describe('projectFields', () => {
  it('returns the full item when no fields are requested', () => {
    const item = toListItem(row(), 1);
    expect(projectFields(item, undefined)).toBe(item);
  });

  it('keeps only requested (whitelisted) columns, always including id', () => {
    const projected = projectFields(toListItem(row(), 1), 'username,email,bogus');
    expect(Object.keys(projected).sort()).toEqual(['email', 'id', 'username']);
  });

  it('falls back to the full item when no valid columns are requested', () => {
    const item = toListItem(row(), 1);
    expect(projectFields(item, 'bogus,nope')).toBe(item);
  });
});

describe('toExportRow', () => {
  it('produces a flat, csv-friendly record with empty strings for null dates', () => {
    const record = toExportRow(row({ lastLoginAt: null }), 2);
    expect(record).toMatchObject({
      username: 'meera_k',
      displayName: 'Meera',
      draftCount: 2,
      lastLoginAt: '',
      deletedAt: '',
    });
  });
});
