import { QDialog, cn } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useFollowers, useFollowing } from '../hooks/use-follow-lists';
import { FollowList } from './follow-list';

export type ConnectionsTab = 'followers' | 'following';

/**
 * Followers ⇄ Following as a dialog with a tab switch (docs/06 §3.5 — "tab or dialog"; docs/26
 * §10). Each list fetches only while its tab is active AND the dialog is open (`enabled` gating),
 * so opening "Followers" never also pulls "Following". Below `sm` the QDialog renders as a bottom
 * sheet (docs/06 §11).
 */
export function FollowConnectionsDialog({
  open,
  onClose,
  username,
  penName,
  tab,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
  penName: string;
  tab: ConnectionsTab;
  onTabChange: (tab: ConnectionsTab) => void;
}): ReactElement {
  const followers = useFollowers(username, open && tab === 'followers');
  const following = useFollowing(username, open && tab === 'following');

  const tabs: readonly { key: ConnectionsTab; label: string }[] = [
    { key: 'followers', label: 'Followers' },
    { key: 'following', label: 'Following' },
  ];

  return (
    <QDialog open={open} onClose={onClose} title={penName} size="sm">
      <div role="tablist" aria-label="Connections" className="mb-3 flex gap-1 border-b border-line">
        {tabs.map(({ key, label }) => {
          const active = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(key)}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-secondary hover:text-ink',
              )}
            >
              {label}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="max-h-[60vh] min-h-[240px] overflow-y-auto">
        {tab === 'followers' ? (
          <FollowList
            query={followers}
            emptyTitle="No followers yet."
            emptyDescription="When readers follow this writer, they’ll appear here."
          />
        ) : (
          <FollowList
            query={following}
            emptyTitle="Not following anyone yet."
            emptyDescription="Writers this account follows will appear here."
          />
        )}
      </div>
    </QDialog>
  );
}
