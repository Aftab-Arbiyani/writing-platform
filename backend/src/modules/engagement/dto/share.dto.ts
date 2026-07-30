import { ApiProperty } from '@nestjs/swagger';
import { ShareChannel } from '@qalam/shared';
import { IsEnum } from 'class-validator';

/**
 * `POST /pieces/:id/shares` body. Phase 1 tracks the COUNT only — no analytics
 * dashboard (ADR §10). `channel` records how the piece was shared.
 */
export class ShareDto {
  @ApiProperty({
    enum: Object.values(ShareChannel),
    description: 'internal | external | copy_link',
  })
  @IsEnum(ShareChannel)
  channel!: ShareChannel;
}

/** `{ totalShares }` — the piece's running share count. */
export class ShareResponseDto {
  @ApiProperty() totalShares!: number;
}
