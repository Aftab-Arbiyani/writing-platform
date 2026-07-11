import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PiecesModule } from '../pieces/pieces.module';
import { UsersModule } from '../users/users.module';
import { CommentsController } from './comments.controller';
import { CommentsRepository } from './comments.repository';
import { CommentsService } from './comments.service';
import { CollectionsController } from './collections.controller';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
import { Bookmark } from './entities/bookmark.entity';
import { Clap } from './entities/clap.entity';
import { Collection } from './entities/collection.entity';
import { CollectionPiece } from './entities/collection-piece.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { PieceResponse } from './entities/piece-response.entity';
import { PieceStats } from './entities/piece-stats.entity';
import { Share } from './entities/share.entity';
import { PieceStatsRepository } from './piece-stats.repository';
import { PieceStatsService } from './piece-stats.service';
import { ReactionsController } from './reactions.controller';
import { ReactionsRepository } from './reactions.repository';
import { ReactionsService } from './reactions.service';
import { ResponsesController } from './responses.controller';
import { ResponsesRepository } from './responses.repository';
import { ResponsesService } from './responses.service';
import { SharesController } from './shares.controller';
import { SharesRepository } from './shares.repository';
import { SharesService } from './shares.service';

/**
 * Social Engagement (E7 — social & curation): comments + threaded replies,
 * likes, claps, bookmarks, collections, responses, and share tracking.
 *
 * Reuses `PiecesModule` (piece existence + read visibility + published gate via
 * `PiecesService.getEngageablePiece`, and `createDraft` for responses) and
 * `UsersModule` (author summaries for comments) — through their exported
 * services only, never their repositories (docs 16 §3.1). Guards/decorators are
 * file-imported from auth (no AuthModule import → no circular dependency).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PieceStats,
      Comment,
      Like,
      Clap,
      Bookmark,
      Collection,
      CollectionPiece,
      PieceResponse,
      Share,
    ]),
    PiecesModule,
    UsersModule,
  ],
  controllers: [
    CommentsController,
    ReactionsController,
    CollectionsController,
    ResponsesController,
    SharesController,
  ],
  providers: [
    PieceStatsRepository,
    PieceStatsService,
    CommentsRepository,
    CommentsService,
    ReactionsRepository,
    ReactionsService,
    CollectionsRepository,
    CollectionsService,
    ResponsesRepository,
    ResponsesService,
    SharesRepository,
    SharesService,
  ],
  exports: [PieceStatsService, CommentsService],
})
export class EngagementModule {}
