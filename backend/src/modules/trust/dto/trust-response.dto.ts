import { ApiProperty } from '@nestjs/swagger';
import type {
  RestrictionScope,
  RestrictionType,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
  UserStatus,
} from '@qalam/shared';

import type { BlockKind } from '../trust.constants';

/** An active or historical restriction on a user's account. */
export class RestrictionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() type!: RestrictionType;
  @ApiProperty() scope!: RestrictionScope;
  @ApiProperty() reason!: string;
  @ApiProperty() issuedById!: string;
  @ApiProperty({ nullable: true }) expiresAt!: string | null;
  @ApiProperty({ nullable: true }) liftedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/** A single policy strike. */
export class StrikeDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() severity!: StrikeSeverity;
  @ApiProperty() reason!: string;
  @ApiProperty() weight!: number;
  @ApiProperty({ nullable: true }) reportId!: string | null;
  @ApiProperty() issuedById!: string;
  @ApiProperty({ nullable: true }) expiresAt!: string | null;
  @ApiProperty({ nullable: true }) revokedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/** A personal block or mute edge. */
export class BlockDto {
  @ApiProperty() id!: string;
  @ApiProperty() blockerId!: string;
  @ApiProperty() blockedId!: string;
  @ApiProperty({ enum: ['block', 'mute'] }) kind!: BlockKind;
  @ApiProperty() createdAt!: string;
}

/** The current user's (or an inspected user's) trust standing at a glance. */
export class TrustSummaryDto {
  @ApiProperty({ description: 'Reputation score, 0–100.' }) score!: number;
  @ApiProperty({ description: 'Reputation tier derived from the score.' }) level!: TrustLevel;
  @ApiProperty({ description: 'Effective trust status the Policy Engine sees.' })
  status!: TrustStatus;
  @ApiProperty({ description: 'Summed weight of currently-active strikes.' })
  activeStrikeWeight!: number;
  @ApiProperty({ type: [RestrictionDto], description: 'Currently-active restrictions.' })
  restrictions!: RestrictionDto[];

  /**
   * The ACCOUNT's status (`users.status`) — present on the admin read only (B9, A2-1).
   *
   * Trust standing and account status are two different sanctions, and the trust
   * standing alone would render "Good standing" for an account an operator had
   * already suspended. It is optional because the self read (`me/trust`) has no use
   * for it: a suspended account cannot hold a session to ask with.
   */
  @ApiProperty({
    required: false,
    description: "The account's own status — admin read only. Absent on `me/trust`.",
  })
  accountStatus?: UserStatus;
}
