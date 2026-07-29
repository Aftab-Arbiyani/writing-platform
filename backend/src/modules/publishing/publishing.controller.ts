import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS, SnapshotReason } from '@qalam/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { PieceResponseDto } from '../pieces/dto/piece-response.dto';
import {
  ChangeVisibilityDto,
  RequestChangesDto,
  SchedulePublicationDto,
} from './dto/publishing-request.dto';
import { PublicationEventDto, ReviewDto, SnapshotDto } from './dto/publishing-response.dto';
import { PublishingService } from './publishing.service';
import { ReviewService } from './review.service';
import { SnapshotService } from './snapshot.service';

/**
 * Editorial publishing HTTP surface (AF6). All routes are authenticated (global
 * JwtAuthGuard) and coarse-gated by `@Permissions(...)`; the fine-grained
 * decision (ownership, story role, trust, review gate) is made by the Policy
 * Engine inside each service. Thin controllers (docs 16 §3.6) — no business
 * logic, no try/catch (the global exception filter shapes errors). `:id` is the
 * story id, which is the piece id (`storyId === pieceId`).
 */
@ApiTags('publishing')
@ApiBearerAuth()
@Controller()
export class PublishingController {
  constructor(
    private readonly publishing: PublishingService,
    private readonly reviews: ReviewService,
    private readonly snapshots: SnapshotService,
  ) {}

  // ── Publication lifecycle ────────────────────────────────────────────────────

  @Post('stories/:id/publish')
  @Permissions(PERMISSIONS.PiecePublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a story (blocked if an open review is not approved).' })
  @ApiOkResponse({ type: PieceResponseDto })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.publishing.publish(id, user);
  }

  @Post('stories/:id/unpublish')
  @Permissions(PERMISSIONS.PiecePublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish (archive) a published story.' })
  @ApiOkResponse({ type: PieceResponseDto })
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PieceResponseDto> {
    return this.publishing.unpublish(id, user);
  }

  @Post('stories/:id/schedule')
  @Permissions(PERMISSIONS.PiecePublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule a future publish.' })
  @ApiOkResponse({ type: PieceResponseDto })
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePublicationDto,
  ): Promise<PieceResponseDto> {
    return this.publishing.schedule(id, user, dto.scheduledAt);
  }

  @Patch('stories/:id/visibility')
  @Permissions(PERMISSIONS.PiecePublish)
  @ApiOperation({ summary: "Change a story's visibility." })
  @ApiOkResponse({ type: PieceResponseDto })
  changeVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVisibilityDto,
  ): Promise<PieceResponseDto> {
    return this.publishing.changeVisibility(id, user, dto.visibility);
  }

  // ── Review workflow ──────────────────────────────────────────────────────────
  //
  // All four routes are coarse-gated on `collaboration.use`, never on
  // `publishing.approve`. The reviewer decision is authorized by the Policy
  // Engine against the story (`ACTION_STAFF_PERMISSION` for the staff path,
  // ownership + `ACTION_MIN_STORY_ROLE` for the member path — policy.constants
  // documents both as coexisting). Gating the route on `publishing.approve` put a
  // second, coarser authz path in front of that SSOT and 403'd the story owner
  // the capability map had just told `review.approve: allowed` (defect W3c-1,
  // docs/48 §3.4). Staff keep their path: `moderator`/`admin` inherit
  // `collaboration.use` from `user` by rank inheritance (PermissionResolver).

  @Post('stories/:id/review')
  @Permissions(PERMISSIONS.CollaborationUse)
  @ApiOperation({ summary: 'Request an editorial review for a story.' })
  @ApiCreatedResponse({ type: ReviewDto })
  requestReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReviewDto> {
    return this.reviews.request(id, user);
  }

  @Post('stories/:id/review/approve')
  @Permissions(PERMISSIONS.CollaborationUse)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a story in review (unlocks publish).' })
  @ApiOkResponse({ type: ReviewDto })
  approveReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReviewDto> {
    return this.reviews.approve(id, user);
  }

  @Post('stories/:id/review/changes')
  @Permissions(PERMISSIONS.CollaborationUse)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request changes on a story in review.' })
  @ApiOkResponse({ type: ReviewDto })
  requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestChangesDto,
  ): Promise<ReviewDto> {
    return this.reviews.requestChanges(id, user, dto.notes);
  }

  @Get('stories/:id/review')
  @Permissions(PERMISSIONS.CollaborationUse)
  @ApiOperation({ summary: 'The current review session for a story (null if none).' })
  @ApiOkResponse({ type: ReviewDto })
  getReview(@Param('id', ParseUUIDPipe) id: string): Promise<ReviewDto | null> {
    return this.reviews.get(id);
  }

  // ── Snapshots ────────────────────────────────────────────────────────────────

  @Get('stories/:id/snapshots')
  @Permissions(PERMISSIONS.PiecePublish)
  @ApiOperation({ summary: "List a story's content snapshots (newest version first)." })
  @ApiOkResponse({ type: [SnapshotDto] })
  listSnapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotDto[]> {
    return this.snapshots.list(id, user);
  }

  @Post('stories/:id/snapshots')
  @Permissions(PERMISSIONS.PiecePublish)
  @ApiOperation({ summary: 'Capture a manual content snapshot of a story.' })
  @ApiCreatedResponse({ type: SnapshotDto })
  createSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotDto> {
    return this.snapshots.create(id, user, SnapshotReason.Manual);
  }

  @Get('snapshots/:id')
  @Permissions(PERMISSIONS.PiecePublish)
  @ApiOperation({ summary: 'Get one content snapshot by id.' })
  @ApiOkResponse({ type: SnapshotDto })
  getSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotDto> {
    return this.snapshots.get(id, user);
  }

  @Post('stories/:id/snapshots/:snapshotId/revert')
  @Permissions(PERMISSIONS.PiecePublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revert a story to a snapshot's content." })
  @ApiOkResponse({ type: PieceResponseDto })
  revertSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
  ): Promise<PieceResponseDto> {
    return this.snapshots.revert(id, snapshotId, user);
  }

  // ── Publishing history ─────────────────────────────────────────────────────

  @Get('stories/:id/publication-history')
  @Permissions(PERMISSIONS.PiecePublish)
  @ApiOperation({ summary: 'The immutable publishing history for a story (newest first).' })
  @ApiOkResponse({ type: [PublicationEventDto] })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicationEventDto[]> {
    return this.publishing.history(id, user);
  }
}
