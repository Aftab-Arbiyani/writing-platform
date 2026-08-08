import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { UsersModule } from '../users/users.module';
import { Piece } from './entities/piece.entity';
import { PieceTag } from './entities/piece-tag.entity';
import { PiecesController } from './pieces.controller';
import { PiecesRepository } from './pieces.repository';
import { PiecesService } from './pieces.service';

/**
 * Writing engine (E4). Reuses `TaxonomyModule` (language/genre/tag resolution),
 * `UsersModule` (author + profile privacy + piece count via its exported
 * services — never its repositories, docs 16 §3.1), and the global `MediaModule`
 * (cover upload). Guards/decorators are file-imported from auth (no AuthModule
 * import → no circular dependency).
 *
 * `EntitlementService` (AF5) is injected for B4's plan piece cap without importing
 * `MonetizationModule` — that module is `@Global` and exports it, which is also why adding the
 * cap introduces no module cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Piece, PieceTag]), TaxonomyModule, UsersModule],
  controllers: [PiecesController],
  providers: [PiecesRepository, PiecesService],
  exports: [PiecesService],
})
export class PiecesModule {}
