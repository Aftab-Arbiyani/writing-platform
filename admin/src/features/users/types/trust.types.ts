import type {
  RestrictionScope,
  RestrictionType,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
} from '@qalam/shared';

/**
 * Wire types for the admin Trust surface (AF6, row A2) — five routes on
 * `trust.admin.controller.ts`, mirrored field for field from `dto/trust-response.dto.ts`
 * and `dto/trust-request.dto.ts`.
 *
 * They live in `features/users/` rather than a `features/trust/` of their own because the
 * surface has one owner and two entry points (a tab on the user drawer, and the `/trust`
 * route for the moderator who cannot reach `/users`) — see `trust-panel.tsx`. A separate
 * feature would have to be imported sideways by the drawer, which `features/README.md`
 * forbids.
 */

/** `RestrictionDto` — an active OR historical restriction. `liftedAt`/`expiresAt` decide which. */
export interface AdminRestriction {
  id: string;
  userId: string;
  type: RestrictionType;
  scope: RestrictionScope;
  reason: string;
  issuedById: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdAt: string;
}

/**
 * `StrikeDto` — returned by `POST users/:id/strikes` and **nowhere else**. There is no
 * route that lists a user's strikes, so this shape is only ever seen once, as the result
 * of issuing one (defect A2-2).
 */
export interface AdminStrike {
  id: string;
  userId: string;
  severity: StrikeSeverity;
  reason: string;
  weight: number;
  reportId: string | null;
  issuedById: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * `TrustSummaryDto` — the standing.
 *
 * `restrictions` here carries the **active** ones only (`listActiveRestrictions`), which is a
 * different set from what `GET users/:id/restrictions` returns (active AND historical). The two
 * reads are never conflated: the standing card reads this one, the history list reads the other.
 */
export interface AdminTrustSummary {
  score: number;
  level: TrustLevel;
  status: TrustStatus;
  activeStrikeWeight: number;
  restrictions: AdminRestriction[];
}

/** `IssueStrikeDto` — `severity` + `reason` required; `reportId` and `expiresAt` optional. */
export interface IssueStrikePayload {
  severity: StrikeSeverity;
  reason: string;
  reportId?: string;
  expiresAt?: string;
}

/** `ApplyRestrictionDto` — `type` + `scope` + `reason` required; omit `expiresAt` for permanent. */
export interface ApplyRestrictionPayload {
  type: RestrictionType;
  scope: RestrictionScope;
  reason: string;
  expiresAt?: string;
}
