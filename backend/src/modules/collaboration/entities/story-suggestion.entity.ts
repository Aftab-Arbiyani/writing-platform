import { Column, Entity, Index } from 'typeorm';
import { SuggestionStatus } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/** Text-range anchor for a suggestion (TipTap document positions). */
export interface SuggestionAnchor {
  from: number;
  to: number;
}

/**
 * A proposed edit to a story's text (AF6, "track changes"). A reviewer/editor
 * proposes replacing the text in `[from, to)` (captured verbatim in
 * `originalText`) with `suggestedText`; the owner or a co-author accepts or
 * rejects, the author may withdraw.
 *
 * Accepting marks the suggestion `accepted` AND applies it: the anchored range of
 * the piece body is rewritten to `suggestedText` (through `PiecesService`, in the
 * same transaction). `anchor` + `originalText` are the guard — if the text at
 * `[from, to)` in the current plain-text projection is no longer `originalText`,
 * acceptance is a `SUGGESTION_CONFLICT` and nothing is written.
 */
@Entity('story_suggestions')
@Index('idx_story_suggestion', ['storyId', 'status'])
export class StorySuggestion extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'jsonb' })
  anchor!: SuggestionAnchor;

  @Column({ type: 'text' })
  originalText!: string;

  @Column({ type: 'text' })
  suggestedText!: string;

  @Column({ type: 'varchar', length: 12, default: SuggestionStatus.Pending })
  status!: SuggestionStatus;

  /** Who accepted/rejected (or the author, on withdraw); null while pending. */
  @Column({ type: 'uuid', nullable: true })
  resolvedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
