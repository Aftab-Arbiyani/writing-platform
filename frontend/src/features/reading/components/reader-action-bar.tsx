import { ReportEntityType, ShareChannel } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import {
  Bookmark,
  BookMarked,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react';
import { type ComponentType, type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';

import { SaveToCollectionDialog } from '@/components/collections';
import { ReportDialog } from '@/components/report-dialog';
import { getErrorMessage } from '@/lib/errors';
import { formatCount } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { ClapButton } from './clap-button';
import { useEngagementActions } from '../hooks/use-engagement';
import type { PieceEngagement } from '../types/reading.types';

/**
 * The reading view's engagement bar (W1, docs/45 §4.1) — the web analog of mobile's
 * `reader_action_bar`.
 *
 * **Every count on this bar is now an action, and the two deferrals in W1's version of this comment
 * are both discharged.** Responses got their surface in W7a (the conversation layer, inline at the
 * end of the page); claps got their interaction model in W7b (`use-claps` — accumulating, batched,
 * capped, optimistic). What is left read-only is the responses COUNT, and only because the surface
 * it links to is already on the same page.
 *
 * Like and bookmark toggle; clap accumulates toward `MAX_CLAPS_PER_USER_PER_PIECE` and its removal
 * takes all of them at once (there is no decrement endpoint). All are optimistic, so counts move as
 * the reader clicks.
 *
 * Save-to-collection and Report live in a "More" menu rather than on the bar — mobile's action bar
 * makes the same split, for the same reason: they are deliberate, low-frequency acts and the bar is
 * for the reflexive ones.
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
  pieceTitle,
  engagement,
  isLoading,
  shareUrl,
  returnTo,
}: {
  pieceId: string;
  /** The piece's title — the save-to-collection dialog names what is being filed. */
  pieceTitle: string;
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
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);

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

  const moreMenu: MenuProps['items'] = [
    {
      key: 'save',
      icon: <BookMarked size={16} strokeWidth={1.5} />,
      label: 'Save to a collection',
      onClick: () => requireAuth(() => setSaving(true)),
    },
    {
      key: 'report',
      icon: <Flag size={16} strokeWidth={1.5} />,
      label: 'Report this piece',
      onClick: () => requireAuth(() => setReporting(true)),
    },
  ];

  return (
    <div
      className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-2"
      aria-label="Engagement on this piece"
    >
      {/* Clap leads: it is the one gesture a reader repeats, and W7b is what made it a gesture. */}
      <ClapButton
        pieceId={pieceId}
        engagement={engagement}
        authed={authed}
        onRequireAuth={() => {
          void navigate(`${ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`);
        }}
      />
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

      {/* Save + Report: deliberate, low-frequency acts, behind one affordance — the same split
          mobile's action bar makes with its "More" sheet. */}
      <Dropdown menu={{ items: moreMenu }} trigger={['click']} placement="bottomLeft">
        <QButton
          variant="ghost"
          size="sm"
          icon={MoreHorizontal}
          className="text-ink-muted"
          aria-label="More actions on this piece"
        />
      </Dropdown>

      {/* The responses count stays a read-only stat, and now for a good reason rather than a
          deferral: W7a put the responses themselves further down this same page, so the number is a
          summary of something already on screen. */}
      <span className="ms-auto flex items-center gap-4">
        <Stat icon={MessageCircle} value={stats.responses} label="responses" />
      </span>

      {saving ? (
        <SaveToCollectionDialog
          open
          onClose={() => setSaving(false)}
          pieceId={pieceId}
          pieceTitle={pieceTitle}
        />
      ) : null}
      {reporting ? (
        <ReportDialog
          open
          onClose={() => setReporting(false)}
          entityType={ReportEntityType.Piece}
          entityId={pieceId}
          subject="this piece"
        />
      ) : null}
    </div>
  );
}
