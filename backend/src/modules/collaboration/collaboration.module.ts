import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications';
import { PiecesModule } from '../pieces/pieces.module';
import { PublishingModule } from '../publishing/publishing.module';
import { ActivityService } from './activity.service';
import { COLLABORATION_NOTIFIER } from './collaboration-notifier.port';
import { CollaborationController } from './collaboration.controller';
import { CollaborationRepository } from './collaboration.repository';
import { CollaboratorSeatService } from './collaborator-seat.service';
import { CommentService } from './comment.service';
import { NotificationsCollaborationNotifier } from './notifications-collaboration-notifier.adapter';
import { CollaborationActivity } from './entities/collaboration-activity.entity';
import { CollaborationComment } from './entities/collaboration-comment.entity';
import { StoryInvitation } from './entities/story-invitation.entity';
import { StoryMembership } from './entities/story-membership.entity';
import { StorySuggestion } from './entities/story-suggestion.entity';
import { InvitationService } from './invitation.service';
import { MembershipService } from './membership.service';
import { PresenceService } from './presence.service';
import { StoryMembershipProvider } from './story-membership.provider';
import { SuggestionService } from './suggestion.service';

/**
 * Story Collaboration (AF6) — membership/roles, invitations, comments,
 * suggestions, an activity feed, and ephemeral presence for a piece viewed as a
 * collaborative work (`storyId === pieceId`).
 *
 * Authorization for every write is delegated to the (`@Global`) Policy Engine —
 * this module never re-implements permission logic. It registers its membership
 * lookup with the engine via {@link StoryMembershipProvider} (the engine's story
 * role port), so the engine resolves story roles without depending on this module
 * (no cycle). Story facts are resolved through the exported `PiecesService`
 * (`getStoryContext`), never by importing the pieces repository. `PermissionsModule`
 * (the `collaboration.use` gate) is `@Global` — injected, not imported.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoryMembership,
      StoryInvitation,
      CollaborationComment,
      StorySuggestion,
      CollaborationActivity,
    ]),
    PiecesModule,
    AuditModule,
    NotificationsModule,
    // For `SnapshotService` only — accepting a suggestion rewrites the story body,
    // so the pre-edit content is versioned through publishing's existing snapshot
    // mechanism rather than a second one here. Publishing does not depend on this
    // module, so the edge is acyclic.
    PublishingModule,
  ],
  controllers: [CollaborationController],
  providers: [
    CollaborationRepository,
    // B6's plan seat cap. `EntitlementService` is injected from the @Global MonetizationModule,
    // exactly as PiecesModule does for B4 — no new module edge, so no cycle.
    CollaboratorSeatService,
    MembershipService,
    InvitationService,
    CommentService,
    SuggestionService,
    ActivityService,
    PresenceService,
    StoryMembershipProvider,
    // Outbound notification port → the platform notifications engine.
    NotificationsCollaborationNotifier,
    { provide: COLLABORATION_NOTIFIER, useExisting: NotificationsCollaborationNotifier },
  ],
  exports: [MembershipService],
})
export class CollaborationModule {}
