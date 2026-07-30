/**
 * Public surface of the notifications module (docs 16 §5.2 — one barrel per
 * backend module). Feature modules never import this; they emit domain events.
 */
export { NotificationsModule } from './notifications.module';
export { NotificationsService } from './notifications.service';
