import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PiecesModule } from '../pieces/pieces.module';
import { UsersModule } from '../users/users.module';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { SystemNotification } from './entities/system-notification.entity';
import { NotificationEventListener } from './notification.listener';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationsCacheService } from './notifications-cache.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { SystemNotificationsController } from './system-notifications.controller';
import { SystemNotificationsRepository } from './system-notifications.repository';

/**
 * Notification Engine (E9). Owns three tables (`forFeature`). Subscribes to
 * decoupled domain events via the global `DomainEventBus` (its listener
 * translates them into `NotificationsService.create()` — the single write path);
 * feature modules never depend on this module, they only emit. Imports
 * `UsersModule` + `PiecesModule` to hydrate the denormalized render payload
 * (actor/piece) through their exported services (docs 16 §3.1). Uses the global
 * `RedisService` (DB 0) for the unread-count cache. Guards/decorators are
 * file-imported from auth (no AuthModule import → no cycle).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference, SystemNotification]),
    UsersModule,
    PiecesModule,
  ],
  controllers: [NotificationsController, SystemNotificationsController],
  providers: [
    NotificationsRepository,
    NotificationPreferencesRepository,
    SystemNotificationsRepository,
    NotificationsCacheService,
    NotificationsService,
    NotificationEventListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
