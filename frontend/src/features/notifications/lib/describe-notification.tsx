import { NotificationType } from '@qalam/shared';
import {
  AtSign,
  Bell,
  FolderPlus,
  Hand,
  Heart,
  Megaphone,
  MessageCircle,
  PenLine,
  Reply,
  Repeat2,
  Sparkles,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { piecePath, profilePath, ROUTES } from '@/lib/routes';

import type { NotificationItem } from '../types/notification.types';

/** Semantic colour tone for the activity glyph — resolved to token classes in the row. */
export type NotificationTone = 'accent' | 'success' | 'danger' | 'info' | 'warning' | 'neutral';

/**
 * The presentational model for one notification row (docs/06 §3.9). Translates the frozen `v1`
 * `type` + denormalized `data` into a type glyph + colour tone, a literary message, an optional
 * preview line, and a link to the related resource — reading `data` defensively (it is
 * `Record<string, unknown>`) and never fabricating fields. Every Phase-1 backend
 * `NotificationType` is handled (incl. the reserved repost/featured/collection_follow); the
 * later monetization/collaboration types (AF5/AF6, whose reader-frontend rendering is deferred)
 * fall through to the graceful Bell/neutral default below, so an unknown type can never render
 * blank. The glyph + tone are what make the inbox read as an activity timeline.
 */
export interface NotificationView {
  icon: LucideIcon;
  tone: NotificationTone;
  message: ReactNode;
  /** Route to the related resource, or null when there is nowhere to go. */
  link: string | null;
  /** Secondary line (e.g. a comment excerpt), or null. */
  preview: string | null;
}

// Partial: Phase-1 types are mapped explicitly; AF5/AF6 types use the Bell/neutral
// fallback in describeNotification() until their dedicated reader rendering lands.
const ICON: Partial<Record<NotificationType, { icon: LucideIcon; tone: NotificationTone }>> = {
  [NotificationType.Follow]: { icon: UserPlus, tone: 'success' },
  [NotificationType.FollowRequest]: { icon: UserPlus, tone: 'accent' },
  [NotificationType.FollowAccepted]: { icon: UserCheck, tone: 'success' },
  [NotificationType.Comment]: { icon: MessageCircle, tone: 'info' },
  [NotificationType.CommentReply]: { icon: Reply, tone: 'info' },
  [NotificationType.Like]: { icon: Heart, tone: 'danger' },
  [NotificationType.Clap]: { icon: Hand, tone: 'accent' },
  [NotificationType.Mention]: { icon: AtSign, tone: 'accent' },
  [NotificationType.Response]: { icon: PenLine, tone: 'info' },
  [NotificationType.Repost]: { icon: Repeat2, tone: 'info' },
  [NotificationType.Featured]: { icon: Sparkles, tone: 'warning' },
  [NotificationType.CollectionFollow]: { icon: FolderPlus, tone: 'success' },
  [NotificationType.System]: { icon: Megaphone, tone: 'neutral' },
};

/** Actor display name: pen name if set, else the @handle. Null when there is no actor (system). */
function actorName(n: NotificationItem): string | null {
  if (!n.actor) return null;
  return n.actor.penName ?? `@${n.actor.username}`;
}

/** Safely read `data.piece` = `{ slug, title }`. */
function readPiece(data: Record<string, unknown>): { slug: string | null; title: string } | null {
  const piece = data.piece;
  if (piece === null || typeof piece !== 'object') return null;
  const p = piece as Record<string, unknown>;
  if (typeof p.title !== 'string') return null;
  return { slug: typeof p.slug === 'string' ? p.slug : null, title: p.title };
}

function readString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readComment(data: Record<string, unknown>): string | null {
  const comment = data.comment;
  if (comment === null || typeof comment !== 'object') return null;
  const c = comment as Record<string, unknown>;
  return typeof c.excerpt === 'string' && c.excerpt.length > 0 ? c.excerpt : null;
}

/** The reading-view path for a piece referenced by a notification, or null. */
function pieceLink(n: NotificationItem, piece: { slug: string | null } | null): string | null {
  if (piece?.slug) return piecePath(piece.slug);
  if (n.entityType === 'piece' && n.entityId) return piecePath(n.entityId);
  return null;
}

/** Render the actor name (bold) — a plain helper, not a component, so it renders inline. */
const renderName = (value: ReactNode): ReactNode => (
  <span className="font-medium text-ink">{value}</span>
);
/** Render a quoted piece title (script-aware `dir`). */
const renderTitle = (value: ReactNode): ReactNode => (
  <span dir="auto" className="text-ink">
    “{value}”
  </span>
);

export function describeNotification(n: NotificationItem): NotificationView {
  const glyph = ICON[n.type] ?? { icon: Bell, tone: 'neutral' as const };
  const name = actorName(n);
  const piece = readPiece(n.data);
  const who = renderName(name ?? 'Someone');

  const base: Pick<NotificationView, 'icon' | 'tone'> = glyph;

  switch (n.type) {
    case NotificationType.Follow:
      return {
        ...base,
        message: <>{who} started following you</>,
        link: n.actor ? profilePath(n.actor.username) : null,
        preview: null,
      };
    case NotificationType.FollowRequest:
      return {
        ...base,
        message: <>{who} requested to follow you</>,
        link: ROUTES.followRequests,
        preview: null,
      };
    case NotificationType.FollowAccepted:
      return {
        ...base,
        message: <>{who} accepted your follow request</>,
        link: n.actor ? profilePath(n.actor.username) : null,
        preview: null,
      };
    case NotificationType.Comment:
      return {
        ...base,
        message: piece ? (
          <>
            {who} commented on {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} commented on your piece</>
        ),
        link: pieceLink(n, piece),
        preview: readComment(n.data),
      };
    case NotificationType.CommentReply:
      return {
        ...base,
        message: <>{who} replied to your comment</>,
        link: pieceLink(n, piece),
        preview: readComment(n.data),
      };
    case NotificationType.Like:
      return {
        ...base,
        message: piece ? (
          <>
            {who} liked {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} liked your piece</>
        ),
        link: pieceLink(n, piece),
        preview: null,
      };
    case NotificationType.Clap:
      return {
        ...base,
        message: piece ? (
          <>
            {who} clapped for {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} clapped for your piece</>
        ),
        link: pieceLink(n, piece),
        preview: null,
      };
    case NotificationType.Mention:
      return {
        ...base,
        message: piece ? (
          <>
            {who} mentioned you in {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} mentioned you</>
        ),
        link: pieceLink(n, piece),
        preview: readComment(n.data),
      };
    case NotificationType.Response:
      return {
        ...base,
        message: piece ? (
          <>
            {who} responded to {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} responded to your piece</>
        ),
        link: pieceLink(n, piece),
        preview: null,
      };
    case NotificationType.Repost:
      return {
        ...base,
        message: piece ? (
          <>
            {who} reposted {renderTitle(piece.title)}
          </>
        ) : (
          <>{who} reposted your piece</>
        ),
        link: pieceLink(n, piece),
        preview: null,
      };
    case NotificationType.Featured:
      return {
        ...base,
        message: piece ? (
          <>Your piece {renderTitle(piece.title)} was featured</>
        ) : (
          <>Your piece was featured</>
        ),
        link: pieceLink(n, piece),
        preview: null,
      };
    case NotificationType.CollectionFollow:
      return {
        ...base,
        message: <>{who} followed your collection</>,
        link: n.actor ? profilePath(n.actor.username) : null,
        preview: null,
      };
    case NotificationType.System: {
      const title = readString(n.data, 'title');
      const body = readString(n.data, 'message');
      return {
        ...base,
        message: title ? renderName(title) : <>System notification</>,
        link: readString(n.data, 'link'),
        preview: body,
      };
    }
    default:
      return { ...base, message: <>You have a new notification</>, link: null, preview: null };
  }
}
