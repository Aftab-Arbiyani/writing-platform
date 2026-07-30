# Notification Engine (E9)

In-app notifications only (ADR §10 — no email/push/FCM/APNs, no WebSockets/real-time).
Event-driven and decoupled: feature modules **emit** domain events; this module
**subscribes** and is the single write path (`NotificationsService.create()`).

## Event flow

```
FollowService / CommentsService / ReactionsService / ResponsesService / PiecesService
        │  (after the transaction commits)
        ▼
  DomainEventBus.emit(event)            ← common/events (dependency-free, error-isolated)
        │
        ▼
  NotificationEventListener             ← subscribes on module init
        │  hydrates actor/piece via UsersService/ProfileService/PiecesService;
        │  extracts @mentions (comment body regex · piece mention nodes)
        ▼
  NotificationsService.create()         ← self-skip · preference gate · dedup · insert · cache-invalidate
        ▼
  notifications table + Redis unread-count invalidation
```

Events → notification types:

| Domain event             | Notification(s)                                  |
| ------------------------ | ------------------------------------------------ |
| `user.followed`          | `follow` (public) or `follow_request` (private)  |
| `follow.accepted`        | `follow_accepted` (to the requester)             |
| `comment.created`        | `comment` / `comment_reply` + `mention` (body)   |
| `reaction.created`       | `clap` / `like` (deduped per actor/piece)        |
| `piece.response.created` | `response`                                       |
| `piece.published`        | `mention` (per mention node in the content)      |
| admin broadcast          | `system` (fanned out to all eligible recipients) |

## Status

Derived from timestamps, never stored: `unread` (read_at null) → `read` (read_at set)
→ `archived` (archived_at set); `deleted` is the soft-delete tombstone (excluded
from every read).

## Endpoints

| Method + path                            | Auth  | Notes                                    |
| ---------------------------------------- | ----- | ---------------------------------------- |
| `GET /notifications`                     | user  | cursor, newest first, status/type filter |
| `GET /notifications/unread-count`        | user  | Redis-cached, `{count, capped}`          |
| `PATCH /notifications/read-all`          | user  | 204                                      |
| `PATCH /notifications/:id/read`          | user  | 204                                      |
| `PATCH /notifications/:id/archive`       | user  | 204                                      |
| `DELETE /notifications/:id`              | user  | 204 (soft)                               |
| `GET /notification-preferences`          | user  | resolved toggles (defaults on)           |
| `PATCH /notification-preferences`        | user  | partial update                           |
| `POST /admin/system-notifications`       | admin | create + broadcast                       |
| `GET /admin/system-notifications`        | admin | management list                          |
| `DELETE /admin/system-notifications/:id` | admin | recall (soft)                            |

## Authorization

Every user endpoint is recipient-scoped (`@CurrentUser()`); a foreign id reads as
`NOTIFICATION_NOT_FOUND` (404, never 403). System-notification management is
`@Roles(Admin)` via `RolesGuard`.

## Preferences

Categories `follow · comment · reply · reaction · mention · response · system`
gate creation (`TYPE_PREFERENCE` maps each type to a category). A missing row =
all enabled.

## Cache

Unread count in Redis DB 0 (`notif:unread:v1:{userId}`), read-through with a 5-min
safety TTL; invalidated explicitly on every create/read/archive/delete and per
recipient on broadcast. Degrades to a live count on Redis failure.

## Data

Three owned tables (`notifications`, `notification_preferences`, `system_notifications`).
The polymorphic target (`entity_type`/`entity_id`) + denormalized `data` payload
(actor username, piece title/slug at emit time) means the inbox lists without joins.

## Extending

Add a `NotificationType` in `@qalam/shared` (the column is `varchar(40)` — no
migration), map it in `TYPE_PREFERENCE`, emit a domain event where it originates,
and handle it in `NotificationEventListener`.

## Tests

- Unit: `common/events/domain-event-bus.spec.ts`, `notifications.service.spec.ts`.
- E2E: `test/notifications.e2e-spec.ts` — every event, dedup, self-skip, mentions,
  unread count + cache, read/archive/delete, cursor pagination, preferences,
  authorization, and admin broadcast.
