import { ShareChannel } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Bookmark, Hand, Heart, Link2, MessageCircle } from 'lucide-react';
import type { ComponentType, ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { getErrorMessage } from '@/lib/errors';
import { formatCount } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { useEngagementActions } from '../hooks/use-engagement';
import type { PieceEngagement } from '../types/reading.types';

/**
 * The reading view's engagement bar (W1, docs/45 §4.1) — the web analog of mobile's
 * `reader_action_bar`.
 *
 * Like, bookmark and share are real actions, applied optimistically (`use-engagement`) so the
 * count moves as the reader clicks. Claps and responses render as read-only counts: claps are a
 * 1..50 accumulating gesture with their own interaction model, and responses need the comment
 * surface, so both belong to the engagement epic rather than to the one that makes reading
 * possible. Nothing is lost meanwhile — the viewer's existing state is shown either way.
 *
 * Anonymous readers see live counts and are routed to sign-in (with `returnTo`) on their first
 * action; sharing is the exception, because `POST /pieces/:id/shares` is public.
 */
function Stat({
  icon: Icon,
  value,
  label,
  active,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  value: number;
  label: string;
  active?: boolean;
}): ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${active ? 'text-accent' : 'text-ink-muted'}`}
      aria-label={`${String(value)} ${label}`}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      <span className="tabular-nums">{formatCount(value)}</span>
    </span>
  );
}

/** An action + its count. `aria-pressed` carries the toggle state (docs/07 §9). */
function Action({
  icon: Icon,
  value,
  label,
  pressedLabel,
  active,
  busy,
  onClick,
}: {
  icon: typeof Heart;
  value?: number;
  label: string;
  pressedLabel: string;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <QButton
      variant="ghost"
      size="sm"
      icon={Icon}
      loading={busy}
      aria-pressed={active}
      aria-label={active ? pressedLabel : label}
      className={active ? 'text-accent' : 'text-ink-muted'}
      onClick={onClick}
    >
      {value === undefined ? null : <span className="tabular-nums">{formatCount(value)}</span>}
    </QButton>
  );
}

export function ReaderActionBar({
  pieceId,
  engagement,
  isLoading,
  shareUrl,
  returnTo,
}: {
  pieceId: string;
  engagement: PieceEngagement | undefined;
  isLoading: boolean;
  /** Absolute URL copied to the clipboard — the piece's canonical link. */
  shareUrl: string;
  /** Where sign-in should send an anonymous reader back to (this piece). */
  returnTo: string;
}): ReactElement | null {
  const navigate = useNavigate();
  const toast = useToast();
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const { like, unlike, bookmark, unbookmark, share } = useEngagementActions(pieceId);

  // Engagement loads as a second wave behind the article — render nothing rather than a
  // flash of zeroes that would then jump to the real counts.
  if (isLoading || !engagement) {
    return null;
  }

  const { stats, viewer } = engagement;

  /** Every write action needs a session; sharing does not. */
  const requireAuth = (action: () => void): void => {
    if (!authed) {
      void navigate(`${ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    action();
  };

  const fail = (title: string) => (err: unknown) => {
    toast.error(title, { description: getErrorMessage(err) });
  };

  const onShare = (): void => {
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        toast.success('Link copied');
        // Best-effort analytics — a failure here must not surface, the copy already happened.
        share.mutate(ShareChannel.CopyLink);
      })
      .catch(() => {
        toast.error('Couldn’t copy the link');
      });
  };

  return (
    <div
      className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-2"
      aria-label="Engagement on this piece"
    >
      <Action
        icon={Heart}
        value={stats.likes}
        label="Like this piece"
        pressedLabel="Unlike this piece"
        active={viewer.hasLiked}
        busy={like.isPending || unlike.isPending}
        onClick={() => {
          requireAuth(() => {
            if (viewer.hasLiked) unlike.mutate(undefined, { onError: fail('Couldn’t unlike') });
            else like.mutate(undefined, { onError: fail('Couldn’t like') });
          });
        }}
      />
      <Action
        icon={Bookmark}
        value={stats.bookmarks}
        label="Bookmark this piece"
        pressedLabel="Remove bookmark"
        active={viewer.hasBookmarked}
        busy={bookmark.isPending || unbookmark.isPending}
        onClick={() => {
          requireAuth(() => {
            if (viewer.hasBookmarked)
              unbookmark.mutate(undefined, { onError: fail('Couldn’t remove the bookmark') });
            else bookmark.mutate(undefined, { onError: fail('Couldn’t bookmark') });
          });
        }}
      />
      <Action
        icon={Link2}
        label="Copy link to this piece"
        pressedLabel="Copy link to this piece"
        active={false}
        busy={false}
        onClick={onShare}
      />

      <span className="ms-auto flex items-center gap-4">
        <Stat icon={Hand} value={stats.claps} label="claps" active={viewer.clapCount > 0} />
        <Stat icon={MessageCircle} value={stats.responses} label="responses" />
      </span>
    </div>
  );
}
