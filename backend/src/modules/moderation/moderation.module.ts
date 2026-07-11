import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EngagementModule } from '../engagement/engagement.module';
import { PiecesModule } from '../pieces/pieces.module';
import { UsersModule } from '../users/users.module';

import { AppealsAdminController } from './appeals.admin.controller';
import { AppealsService } from './appeals.service';
import { Appeal } from './entities/appeal.entity';
import { ReportNote } from './entities/report-note.entity';
import { Report } from './entities/report.entity';
import { UserWarning } from './entities/user-warning.entity';
import { ModerationRepository } from './moderation.repository';
import { ModerationService } from './moderation.service';
import { ModerationUsersController } from './moderation-users.controller';
import { ReportsAdminController } from './reports.admin.controller';
import { ReportsController } from './reports.controller';

/**
 * Content Moderation (A5). Orchestrates existing domain services (pieces,
 * comments, users, auth) + the shared audit trail; owns only its four tables.
 * Reports/appeals/warnings review is moderator/admin; report + appeal creation is
 * any authenticated user.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportNote, Appeal, UserWarning]),
    AuditModule,
    PiecesModule,
    EngagementModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [
    ReportsAdminController,
    AppealsAdminController,
    ModerationUsersController,
    ReportsController,
  ],
  providers: [ModerationRepository, ModerationService, AppealsService],
  exports: [ModerationService],
})
export class ModerationModule {}
