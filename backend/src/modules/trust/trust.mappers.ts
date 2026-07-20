import type { BlockDto, RestrictionDto, StrikeDto } from './dto/trust-response.dto';
import type { UserBlock } from './entities/user-block.entity';
import type { UserRestriction } from './entities/user-restriction.entity';
import type { UserStrike } from './entities/user-strike.entity';

/** Maps a restriction row to its wire shape (never returns the entity raw). */
export function toRestrictionDto(restriction: UserRestriction): RestrictionDto {
  return {
    id: restriction.id,
    userId: restriction.userId,
    type: restriction.type,
    scope: restriction.scope,
    reason: restriction.reason,
    issuedById: restriction.issuedById,
    expiresAt: restriction.expiresAt?.toISOString() ?? null,
    liftedAt: restriction.liftedAt?.toISOString() ?? null,
    createdAt: restriction.createdAt.toISOString(),
  };
}

export function toStrikeDto(strike: UserStrike): StrikeDto {
  return {
    id: strike.id,
    userId: strike.userId,
    severity: strike.severity,
    reason: strike.reason,
    weight: strike.weight,
    reportId: strike.reportId,
    issuedById: strike.issuedById,
    expiresAt: strike.expiresAt?.toISOString() ?? null,
    revokedAt: strike.revokedAt?.toISOString() ?? null,
    createdAt: strike.createdAt.toISOString(),
  };
}

export function toBlockDto(block: UserBlock): BlockDto {
  return {
    id: block.id,
    blockerId: block.blockerId,
    blockedId: block.blockedId,
    kind: block.kind,
    createdAt: block.createdAt.toISOString(),
  };
}
