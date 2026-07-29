import { QEmptyState, QTag } from '@qalam/ui';
import { ShieldOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

import { BlockList } from '../components/block-list';
import { activeRestrictions, isRestricted, useMyTrust } from '../hooks/use-trust';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';
import {
  restrictionScopeLabel,
  restrictionTypeLabel,
  trustStatusLabel,
} from '../lib/publishing-labels';

/**
 * Safety settings (`/settings/blocks`, AF6 W3c — docs/49 §5): the people the viewer has blocked or
 * muted, plus their own account standing.
 *
 * Standing lives here rather than on a page of its own. `GET /me/trust` is account-scoped like the
 * block list, the two are read together, and the design gives the restricted **wall** no route of
 * its own — it is "rendered wherever an effect demands" (§5), which is what `RestrictedWall` does at
 * each surface. So this page states the standing plainly and the wall does the interrupting.
 *
 * In good standing the row is a single reassuring line, not a warning: most viewers will see it, and
 * a safety page that looks alarming by default trains people to ignore it.
 */
export function BlocksPage(): ReactElement {
  usePageTitle('Safety');
  const enabled = isCollaborationEnabled();
  const trust = useMyTrust(enabled);

  if (!enabled) {
    return (
      <QEmptyState
        icon={ShieldOff}
        title="Collaboration is off"
        description="Blocking and muting arrive with collaboration."
      />
    );
  }

  const restricted = isRestricted(trust.data);
  const restrictions = activeRestrictions(trust.data);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Safety</h2>
        <p className="text-ink-secondary text-sm">
          Who you’ve blocked or muted, and how your account stands.
        </p>
      </section>

      <section aria-labelledby="standing-heading" className="flex flex-col gap-2">
        <h3 id="standing-heading" className="text-ink text-base font-semibold">
          Account standing
        </h3>
        {trust.isLoading ? (
          <p className="text-ink-muted text-sm">Loading…</p>
        ) : trust.isError ? (
          // Fails open, like every other trust read: an unavailable standing must not read as a bad
          // one. The server enforces regardless.
          <p className="text-ink-muted text-sm">Your standing isn’t available right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/*
                Good standing reads `success` again. W3c had to use `neutral` here because
                `QTag color="success"` measured 4.01:1 — a token defect this page's a11y scan was
                the first to reach (W3c-2). The token is fixed and the label is now decoupled from
                the fill, so the honest colour is also the accessible one (docs/48 §3.5).
              */}
              <QTag color={restricted ? 'danger' : 'success'} size="sm">
                {trustStatusLabel(trust.data?.status ?? '')}
              </QTag>
              {!restricted ? (
                <span className="text-ink-secondary">
                  You have full access to writing, commenting and publishing.
                </span>
              ) : null}
            </div>
            {restrictions.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {restrictions.map((restriction) => (
                  <li key={restriction.id} className="text-ink-secondary">
                    <span className="text-ink font-medium">
                      {restrictionTypeLabel(restriction.type)}
                    </span>
                    {' · '}
                    {restrictionScopeLabel(restriction.scope)}
                    {restriction.reason ? (
                      <>
                        {' — '}
                        <bdi>{restriction.reason}</bdi>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="blocked-heading" className="flex flex-col gap-2">
        <h3 id="blocked-heading" className="text-ink text-base font-semibold">
          Blocked and muted
        </h3>
        <p className="text-ink-secondary text-sm">
          Blocking stops interaction both ways. Muting only hides someone from you, and they aren’t
          told.
        </p>
        <BlockList />
      </section>
    </div>
  );
}
