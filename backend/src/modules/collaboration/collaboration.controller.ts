import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { CursorMeta } from '@qalam/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { ActivityService } from './activity.service';
import { CommentService } from './comment.service';
import {
  AddMemberDto,
  ChangeRoleDto,
  CollaborationCursorQueryDto,
  CommentListQueryDto,
  CreateCommentDto,
  CreateInvitationDto,
  CreateReplyDto,
  CreateSuggestionDto,
  PresenceHeartbeatDto,
  SuggestionListQueryDto,
} from './dto/collaboration-request.dto';
import {
  ActivityDto,
  CapabilitiesDto,
  CommentDto,
  CommentThreadDto,
  InvitationDto,
  MemberDto,
  PresenceDto,
  SuggestionDto,
} from './dto/collaboration-response.dto';
import { InvitationService } from './invitation.service';
import { MembershipService } from './membership.service';
import { PresenceService } from './presence.service';
import { SuggestionService } from './suggestion.service';

/** A cursor-paginated list envelope (ADR §5 — list handlers attach `meta` explicitly). */
interface ListEnvelope<T> {
  success: true;
  data: T[];
  meta: { pagination: CursorMeta };
}

function listEnvelope<T>(page: { items: T[]; meta: CursorMeta }): ListEnvelope<T> {
  return { success: true, data: page.items, meta: { pagination: page.meta } };
}

/**
 * The story collaboration HTTP surface (AF6). All routes are authenticated
 * (global JwtAuthGuard) and hold the coarse `collaboration.use` permission
 * (class-level `@Permissions`); fine-grained authorization for every WRITE is the
 * Policy Engine's, invoked inside the services (never re-derived here). Thin
 * controllers (docs 16 §3.6): parse input, call a service, shape the response.
 */
@ApiTags('collaboration')
@ApiBearerAuth()
@Permissions(PERMISSIONS.CollaborationUse)
@Controller()
export class CollaborationController {
  constructor(
    private readonly members: MembershipService,
    private readonly invitations: InvitationService,
    private readonly comments: CommentService,
    private readonly suggestions: SuggestionService,
    private readonly activity: ActivityService,
    private readonly presence: PresenceService,
  ) {}

  // ── Members & roles ─────────────────────────────────────────────────────────

  @Get('stories/:storyId/members')
  @ApiOperation({ summary: 'List collaborators on a story (owner included).' })
  @ApiOkResponse({ type: [MemberDto] })
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ): Promise<MemberDto[]> {
    return this.members.listMembers(storyId, user);
  }

  @Post('stories/:storyId/members')
  @ApiOperation({
    summary: 'Add a collaborator directly (owner). Authorized by the Policy Engine.',
  })
  @ApiCreatedResponse({ type: MemberDto })
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberDto> {
    return this.members.addMember(storyId, user, dto);
  }

  @Patch('stories/:storyId/members/:userId')
  @ApiOperation({
    summary: "Change a collaborator's role (owner). Authorized by the Policy Engine.",
  })
  @ApiOkResponse({ type: MemberDto })
  changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<MemberDto> {
    return this.members.changeRole(storyId, user, userId, dto);
  }

  @Delete('stories/:storyId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a collaborator (owner). Authorized by the Policy Engine.' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.members.removeMember(storyId, user, userId);
  }

  @Post('stories/:storyId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a story you collaborate on (not available to the owner).' })
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ): Promise<void> {
    return this.members.leave(storyId, user);
  }

  @Get('stories/:storyId/capabilities')
  @ApiOperation({
    summary: 'The Policy Engine capability map for this story (drives the client permission UI).',
  })
  @ApiOkResponse({ type: CapabilitiesDto })
  capabilities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ): Promise<CapabilitiesDto> {
    return this.members.getCapabilities(storyId, user);
  }

  // ── Invitations ──────────────────────────────────────────────────────────────

  @Post('stories/:storyId/invitations')
  @ApiOperation({ summary: 'Invite a user to collaborate. Authorized by the Policy Engine.' })
  @ApiCreatedResponse({ type: InvitationDto })
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationDto> {
    return this.invitations.invite(storyId, user, dto);
  }

  @Get('stories/:storyId/invitations')
  @ApiOperation({ summary: "A story's invitations (management view)." })
  @ApiOkResponse({ type: [InvitationDto] })
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
  ): Promise<InvitationDto[]> {
    return this.invitations.listForStory(storyId, user);
  }

  @Post('invitations/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation → become a collaborator (invitee).' })
  @ApiOkResponse({ type: MemberDto })
  acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MemberDto> {
    return this.invitations.accept(id, user);
  }

  @Post('invitations/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an invitation (invitee).' })
  @ApiOkResponse({ type: InvitationDto })
  declineInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationDto> {
    return this.invitations.decline(id, user);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Revoke a pending invitation (inviter/owner). Policy-authorized.' })
  @ApiOkResponse({ type: InvitationDto })
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationDto> {
    return this.invitations.revoke(id, user);
  }

  @Get('me/invitations')
  @ApiOperation({ summary: 'My pending story invitations.' })
  @ApiOkResponse({ type: [InvitationDto] })
  myInvitations(@CurrentUser() user: AuthenticatedUser): Promise<InvitationDto[]> {
    return this.invitations.listMine(user.id);
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  @Get('stories/:storyId/comments')
  @ApiOperation({ summary: 'Root comments on a story (cursor-paginated).' })
  @ApiOkResponse({ type: [CommentDto] })
  async listComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Query() query: CommentListQueryDto,
  ): Promise<ListEnvelope<CommentDto>> {
    return listEnvelope(await this.comments.listForStory(storyId, user, query));
  }

  @Post('stories/:storyId/comments')
  @ApiOperation({ summary: 'Add a comment. Authorized by the Policy Engine.' })
  @ApiCreatedResponse({ type: CommentDto })
  createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.create(storyId, user, dto);
  }

  @Get('comments/:id/thread')
  @ApiOperation({ summary: 'A comment thread — the root plus its replies.' })
  @ApiOkResponse({ type: CommentThreadDto })
  thread(@Param('id', ParseUUIDPipe) id: string): Promise<CommentThreadDto> {
    return this.comments.getThread(id);
  }

  @Post('comments/:id/replies')
  @ApiOperation({ summary: 'Reply to a comment thread. Authorized by the Policy Engine.' })
  @ApiCreatedResponse({ type: CommentDto })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReplyDto,
  ): Promise<CommentDto> {
    return this.comments.reply(id, user, dto);
  }

  @Post('comments/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a comment thread. Authorized by the Policy Engine.' })
  @ApiOkResponse({ type: CommentDto })
  resolveComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommentDto> {
    return this.comments.resolve(id, user);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment. Authorized by the Policy Engine.' })
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.comments.delete(id, user);
  }

  // ── Suggestions ────────────────────────────────────────────────────────────────

  @Get('stories/:storyId/suggestions')
  @ApiOperation({ summary: 'Suggestions on a story (cursor-paginated).' })
  @ApiOkResponse({ type: [SuggestionDto] })
  async listSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Query() query: SuggestionListQueryDto,
  ): Promise<ListEnvelope<SuggestionDto>> {
    return listEnvelope(await this.suggestions.listForStory(storyId, user, query));
  }

  @Post('stories/:storyId/suggestions')
  @ApiOperation({ summary: 'Propose an edit. Authorized by the Policy Engine.' })
  @ApiCreatedResponse({ type: SuggestionDto })
  createSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: CreateSuggestionDto,
  ): Promise<SuggestionDto> {
    return this.suggestions.create(storyId, user, dto);
  }

  @Post('suggestions/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a suggestion (conflict-checked). Authorized by the Policy Engine.',
  })
  @ApiOkResponse({ type: SuggestionDto })
  acceptSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.suggestions.accept(id, user);
  }

  @Post('suggestions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a suggestion. Authorized by the Policy Engine.' })
  @ApiOkResponse({ type: SuggestionDto })
  rejectSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.suggestions.reject(id, user);
  }

  @Post('suggestions/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw your own suggestion (self-service via the Policy Engine).' })
  @ApiOkResponse({ type: SuggestionDto })
  withdrawSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuggestionDto> {
    return this.suggestions.withdraw(id, user);
  }

  // ── Activity & presence ────────────────────────────────────────────────────────

  @Get('stories/:storyId/activity')
  @ApiOperation({ summary: "A story's collaboration activity feed (cursor-paginated)." })
  @ApiOkResponse({ type: [ActivityDto] })
  async activityFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Query() query: CollaborationCursorQueryDto,
  ): Promise<ListEnvelope<ActivityDto>> {
    return listEnvelope(await this.activity.listForStory(storyId, user, query));
  }

  @Post('stories/:storyId/presence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Presence heartbeat → the live roster. Authorized by the Policy Engine.',
  })
  @ApiOkResponse({ type: [PresenceDto] })
  heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Body() dto: PresenceHeartbeatDto,
  ): Promise<PresenceDto[]> {
    return this.presence.heartbeat(storyId, user, dto.state);
  }

  @Get('stories/:storyId/presence')
  @ApiOperation({ summary: 'The live presence roster for a story workspace.' })
  @ApiOkResponse({ type: [PresenceDto] })
  presenceRoster(@Param('storyId', ParseUUIDPipe) storyId: string): PresenceDto[] {
    return this.presence.roster(storyId);
  }
}
