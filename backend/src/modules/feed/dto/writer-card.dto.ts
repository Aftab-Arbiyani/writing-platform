import { ApiProperty } from '@nestjs/swagger';

/**
 * A writer in a discovery list (`/discover/writers`). Public presentation only,
 * sourced from denormalized `profiles` counters (no `COUNT(*)`). Private-account
 * writers are excluded from discovery entirely (docs 13 §4.2), so every card
 * here is a public writer.
 */
export class WriterCardDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty() followersCount!: number;
  @ApiProperty() piecesCount!: number;
}
