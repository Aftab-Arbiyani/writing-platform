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
 * Accepting only marks the suggestion `accepted` — applying the edit to the
 * canonical piece content stays with the writer's editor (this module never
 * mutates `pieces`). `originalText` doubles as the conflict guard: if the story
 * text no longer contains it, acceptance is a `SUGGESTION_CONFLICT`.
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
