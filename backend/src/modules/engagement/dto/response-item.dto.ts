import { ApiProperty } from '@nestjs/swagger';

/** Author summary embedded in a response list item. */
export class ResponseAuthorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
}

/**
 * A response to a piece, for `GET /pieces/:id/responses`. A response IS a piece,
 * so this is a lightweight piece summary plus the link timestamp. Only responses
 * whose piece is published + visible to the viewer are listed (docs 13 §4.2).
 */
export class ResponseItemDto {
  @ApiProperty({ description: 'The response (child) piece id.' }) pieceId!: string;
  @ApiProperty({ nullable: true }) slug!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) subtitle!: string | null;
  @ApiProperty({ type: ResponseAuthorDto }) author!: ResponseAuthorDto;
  @ApiProperty({ nullable: true }) publishedAt!: string | null;
  @ApiProperty({ description: 'When the response was linked to the parent.' })
  respondedAt!: string;
}
