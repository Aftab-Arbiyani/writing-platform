import { ApiProperty } from '@nestjs/swagger';
import type { PieceStatus, Visibility } from '@qalam/shared';

import { GenreDto, LanguageDto, TagDto } from '../../taxonomy/dto/taxonomy-item.dto';
import type { SeoMetadata } from '../entities/piece.entity';

/** Author summary embedded in a piece (single lookup, no N+1). */
export class PieceAuthorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
}

/** Full piece for the reading/preview surface (TipTap JSON in `content`). */
export class PieceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: PieceAuthorDto }) author!: PieceAuthorDto;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) subtitle!: string | null;
  @ApiProperty({ nullable: true, description: 'Null until first publish; permanent thereafter.' })
  slug!: string | null;
  @ApiProperty({
    description: 'Canonical TipTap document (clients render it; API never serves HTML).',
  })
  content!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) featuredQuote!: string | null;
  @ApiProperty({ nullable: true }) coverImageKey!: string | null;
  @ApiProperty({ type: LanguageDto, nullable: true }) language!: LanguageDto | null;
  @ApiProperty({ type: GenreDto, nullable: true }) genre!: GenreDto | null;
  @ApiProperty({ type: [TagDto] }) tags!: TagDto[];
  @ApiProperty() status!: PieceStatus;
  @ApiProperty() visibility!: Visibility;
  @ApiProperty() wordCount!: number;
  @ApiProperty() readingTimeSeconds!: number;
  @ApiProperty({ nullable: true }) scheduledAt!: string | null;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty({ nullable: true }) archivedAt!: string | null;
  @ApiProperty({ nullable: true }) seoMetadata!: SeoMetadata | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** Lightweight row for author piece/draft lists. */
export class PieceListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() status!: PieceStatus;
  @ApiProperty() visibility!: Visibility;
  @ApiProperty({ nullable: true }) coverImageKey!: string | null;
  @ApiProperty() wordCount!: number;
  @ApiProperty() readingTimeSeconds!: number;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty({ nullable: true }) scheduledAt!: string | null;
  @ApiProperty() updatedAt!: string;
}

/**
 * How much of the author's plan piece allowance is used (B4, docs/45 §4.9).
 *
 * Exists so a client can say "24 of 25 pieces" *beside the create action* rather than only
 * explaining the cap after a create has already been refused.
 */
export class PieceLimitDto {
  @ApiProperty({ description: 'Live (non-deleted) pieces this author currently holds.' })
  used!: number;

  @ApiProperty({
    description: 'The plan cap. 0 = unlimited, matching the PlanLimits convention.',
    example: 25,
  })
  limit!: number;

  @ApiProperty({
    nullable: true,
    description: 'Slots left (never negative). Null when the plan is unlimited.',
  })
  remaining!: number | null;

  @ApiProperty({ description: 'True when the plan sets no cap (limit 0 / absent).' })
  unlimited!: boolean;

  @ApiProperty({
    description:
      'Whether creating another piece is allowed right now. False also covers the over-limit ' +
      'case a downgrade can produce, where `used` exceeds `limit`.',
  })
  canCreate!: boolean;
}

/** `{ key }` from cover upload — clients build the CDN URL. */
export class PieceCoverResponseDto {
  @ApiProperty({ example: 'pieces/<uuid>/cover-<uuid>.webp' }) key!: string;
}
