import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Genre } from './entities/genre.entity';
import { Language } from './entities/language.entity';
import { TaxonomyRepository } from './taxonomy.repository';
import { TaxonomyService } from './taxonomy.service';

/**
 * Reference data: languages + genres (docs 04 §3.3). Seeded (§9); no management
 * APIs in this epic (genre/language CRUD is admin, E10). Exports `TaxonomyService`
 * (lookups) + `TaxonomyRepository` (seed helpers) as the module surface.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Language, Genre])],
  providers: [TaxonomyRepository, TaxonomyService],
  exports: [TaxonomyService, TaxonomyRepository],
})
export class TaxonomyModule {}
