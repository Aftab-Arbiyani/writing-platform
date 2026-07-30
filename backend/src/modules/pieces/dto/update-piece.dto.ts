import { PartialType } from '@nestjs/swagger';

import { CreatePieceDto } from './create-piece.dto';

/**
 * `PATCH /pieces/:id` body — every field optional (docs 16 §3.2, three-DTO
 * pattern). `languageCode` stays editable; `username`/`slug` are never here
 * (slug is immutable after first publish, set by the publish flow).
 */
export class UpdatePieceDto extends PartialType(CreatePieceDto) {}
