import { POLICY_ACTIONS } from '@qalam/shared';
import { QEmptyState, QSectionHeader } from '@qalam/ui';
import { Send } from 'lucide-react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';

import { PublicationCard } from '../components/publication-card';
import { PublicationHistory } from '../components/publication-history';
import { RestrictedWall } from '../components/restricted-wall';
import { ReviewCard } from '../components/review-card';
import { SnapshotList } from '../components/snapshot-list';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';

/**
 * The publishing workflow for one story (`/write/:storyId/publishing`, AF6 W3c — docs/49 §5).
 *
 * Ported from mobile's `publishing_workflow_screen` after that screen was repaired against the
 * contract: same four sections in the same order (review → publication → versions → history), the
 * same capability gating, and the request shapes its audit corrected (docs/56 §2.2).
 *
 * The whole workflow sits behind {@link RestrictedWall} on `publication.publish`. A plain `deny`
 * means "not your story" and each card's own `CapabilityGate` renders nothing; a *restrictive*
 * effect means "your account is limited", which is a different sentence and gets an explanation
 * instead of an empty page.
 *
 * Like every other page in this feature, the heading is just "Publishing" — it does not fetch the
 * piece to show a title, which keeps the feature from reaching into the writing feature (docs/26 §4).
 */
export function PublishingPage(): ReactElement {
  usePageTitle('Publishing');
  const { storyId = '' } = useParams<{ storyId: string }>();
  const enabled = isCollaborationEnabled();

  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
        <QEmptyState
          icon={Send}
          title="Collaboration is off"
          description="Enable collaboration to manage review and publishing here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-6">
      <QSectionHeader
        title={<h1 className="text-ink font-serif text-2xl font-semibold">Publishing</h1>}
        description="Review, publish, and the story’s version and publication history."
      />

      <RestrictedWall storyId={storyId} action={POLICY_ACTIONS.PublicationPublish}>
        <div className="flex flex-col gap-6">
          <ReviewCard storyId={storyId} />
          <PublicationCard storyId={storyId} />
          <SnapshotList storyId={storyId} />
          <PublicationHistory storyId={storyId} />
        </div>
      </RestrictedWall>
    </div>
  );
}
