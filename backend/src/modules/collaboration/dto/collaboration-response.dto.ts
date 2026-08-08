import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CommentKind,
  CommentStatus,
  InvitationStatus,
  PolicyEffect,
  PolicyObligation,
  PresenceState,
  StoryRole,
  SuggestionStatus,
} from '@qalam/shared';

/** A collaborator on a story (owner is included, synthesised from the piece author). */
export class MemberDto {
  @ApiProperty() userId!: string;
  @ApiProperty() role!: StoryRole;
  @ApiProperty({ nullable: true, type: String }) invitedById!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Join time; null for the owner.' })
  joinedAt!: string | null;
}

/** A story invitation. */
export class InvitationDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() inviterId!: string;
  @ApiProperty() inviteeId!: string;
  @ApiProperty() role!: StoryRole;
  @ApiProperty() status!: InvitationStatus;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ nullable: true, type: String }) respondedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/**
 * How much of a story's collaborator seat allowance is spent (B6, docs/45 §4.11).
 *
 * Mirrors B4's `PieceLimitDto` field-for-field (`used` / `limit` / `remaining` / `unlimited` /
 * a `can…` verb) so the two allowance surfaces read the same on both clients, with one addition:
 * the count is composite, so the parts are published too. It is scoped to the STORY, not the user —
 * the allowance belongs to the story and is charged to whoever owns it.
 */
export class CollaboratorLimitDto {
  @ApiProperty() storyId!: string;

  @ApiProperty({ description: 'Accepted collaborators (the owner is not one).' })
  members!: number;

  @ApiProperty({ description: 'Invitations still outstanding — each holds a seat until answered.' })
  pendingInvitations!: number;

  @ApiProperty({ description: 'Seats spent: members + pendingInvitations.' })
  used!: number;

  @ApiProperty({
    description:
      "The owner's plan cap. -1 = unlimited and 0 = none — B6 INVERTS the usual PlanLimits " +
      'sentinel, because a free story genuinely gets zero seats. Read `unlimited`, not `limit === 0`.',
    example: 3,
  })
  limit!: number;

  @ApiProperty({
    nullable: true,
    description: 'Seats left (never negative). Null when the plan is unlimited.',
  })
  remaining!: number | null;

  @ApiProperty({ description: 'True when the plan sets no seat cap (limit -1).' })
  unlimited!: boolean;

  @ApiProperty({
    description:
      'True when another seat can be offered. False for every free story — the invite affordance ' +
      'stays visible and becomes an upsell, it is never hidden.',
  })
  canInvite!: boolean;
}

/** Inline-comment anchor (echoed back on the wire). */
export class CommentAnchorViewDto {
  @ApiProperty() from!: number;
  @ApiProperty() to!: number;
  @ApiPropertyOptional({ type: String }) quote?: string;
}

/** A collaboration comment or reply. */
export class CommentDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty({ nullable: true, type: String }) parentId!: string | null;
  @ApiProperty() kind!: CommentKind;
  @ApiProperty({ nullable: true, type: CommentAnchorViewDto })
  anchor!: CommentAnchorViewDto | null;
  @ApiProperty() body!: string;
  @ApiProperty() status!: CommentStatus;
  @ApiProperty({ nullable: true, type: String }) resolvedById!: string | null;
  @ApiProperty({ type: [String] }) mentions!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** A root comment plus its replies. */
export class CommentThreadDto {
  @ApiProperty({ type: CommentDto }) comment!: CommentDto;
  @ApiProperty({ type: [CommentDto] }) replies!: CommentDto[];
}

/** Suggestion anchor (echoed back on the wire). */
export class SuggestionAnchorViewDto {
  @ApiProperty() from!: number;
  @ApiProperty() to!: number;
}

/** A proposed edit to a story's text. */
export class SuggestionDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty({ type: SuggestionAnchorViewDto }) anchor!: SuggestionAnchorViewDto;
  @ApiProperty() originalText!: string;
  @ApiProperty() suggestedText!: string;
  @ApiProperty() status!: SuggestionStatus;
  @ApiProperty({ nullable: true, type: String }) resolvedById!: string | null;
  @ApiProperty({ nullable: true, type: String }) resolvedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/** One event in a story's activity feed. */
export class ActivityDto {
  @ApiProperty() id!: string;
  @ApiProperty() storyId!: string;
  @ApiProperty() actorId!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ type: Object }) metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
}

/** A collaborator's live presence in a story workspace. */
export class PresenceDto {
  @ApiProperty() userId!: string;
  @ApiProperty() state!: PresenceState;
  @ApiProperty() lastSeenAt!: string;
}

/** One capability decision the client reflects (from the Policy Engine's `explain`). */
export class CapabilityDto {
  @ApiProperty() action!: string;
  @ApiProperty() effect!: PolicyEffect;
  @ApiProperty() allowed!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: [String] }) obligations!: PolicyObligation[];
}

/** The full capability map for a story (`GET /stories/:storyId/capabilities`). */
export class CapabilitiesDto {
  @ApiProperty() storyId!: string;
  @ApiProperty({ type: [CapabilityDto] }) capabilities!: CapabilityDto[];
}
