import { ApiProperty } from '@nestjs/swagger';
import type {
  RestrictionScope,
  RestrictionType,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
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
}
