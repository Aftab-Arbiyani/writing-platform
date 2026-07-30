import { PERMISSIONS } from '@qalam/shared';
import { QErrorState, QSectionHeader, QSkeleton } from '@qalam/ui';
import {
  Bookmark,
  BookOpen,
  CalendarClock,
  Eye,
  FileEdit,
  FileText,
  Flag,
  HandHeart,
  HardDrive,
  Lock,
  MessageSquare,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { memo, type ReactElement } from 'react';

import { AccessDenied } from '@/components/access-denied';
import { DashboardGrid } from '@/components/dashboard-grid';
import { StatCard } from '@/components/stat-card';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCount } from '@/lib/format';

import { usePlatformStats } from '../hooks/use-platform-stats';

const UNAVAILABLE = 'Not available yet';

/**
 * Platform overview + growth. Real counts come from `GET /analytics/platform`. Fields the frozen
 * backend does NOT expose (verified users, private accounts, reports/pending reports, media storage)
 * are shown as explicit "—/unavailable" tiles — never fabricated — so the section is honest and will
 * light up if/when those endpoints ship. Memoized; gated on `analytics.view`.
 */
export const OverviewWidget = memo(function OverviewWidget(): ReactElement {
  const { can } = usePermissions();
  const allowed = can(PERMISSIONS.AnalyticsView);
  const stats = usePlatformStats();

  function overviewBody(): ReactElement {
    if (!allowed) {
      return (
        <AccessDenied description="Viewing platform statistics requires the analytics.view permission." />
      );
    }
    if (stats.isLoading) {
      return (
        <DashboardGrid>
          {Array.from({ length: 8 }, (_, index) => (
            <QSkeleton key={index} variant="rect" height={92} radius="md" className="w-full" />
          ))}
        </DashboardGrid>
      );
    }
    if (stats.isError || !stats.data) {
      return (
        <QErrorState
          description="Couldn't load platform statistics."
          onRetry={() => void stats.refetch()}
          minHeight={200}
        />
      );
    }

    const data = stats.data;
    return (
      <DashboardGrid>
        <StatCard label="Total users" value={formatCount(data.totalUsers)} icon={Users} />
        <StatCard
          label="Published pieces"
          value={formatCount(data.publishedPieces)}
          icon={FileText}
        />
        <StatCard label="Drafts" value={formatCount(data.draftPieces)} icon={FileEdit} />
        <StatCard label="Comments" value={formatCount(data.comments)} icon={MessageSquare} />
        <StatCard label="Claps" value={formatCount(data.claps)} icon={HandHeart} />
        <StatCard label="Bookmarks" value={formatCount(data.bookmarks)} icon={Bookmark} />
        <StatCard label="Views" value={formatCount(data.views)} icon={Eye} />
        <StatCard label="Reads" value={formatCount(data.reads)} icon={BookOpen} />
        {/* No backend field — shown as unavailable, not faked. */}
        <StatCard label="Verified users" value="—" hint={UNAVAILABLE} icon={UserCheck} />
        <StatCard label="Private accounts" value="—" hint={UNAVAILABLE} icon={Lock} />
        <StatCard label="Reports" value="—" hint={UNAVAILABLE} icon={Flag} />
        <StatCard label="Pending reports" value="—" hint={UNAVAILABLE} icon={CalendarClock} />
        <StatCard label="Storage usage" value="—" hint={UNAVAILABLE} icon={HardDrive} />
      </DashboardGrid>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <QSectionHeader title="Platform overview" description="All-time platform totals." />
        {overviewBody()}
      </section>

      {allowed && stats.data ? (
        <section className="flex flex-col gap-3">
          <QSectionHeader
            title="Platform growth"
            description="Active users and recent sign-ups (fixed backend windows)."
          />
          <DashboardGrid>
            <StatCard
              label="New registrations"
              value={formatCount(stats.data.newRegistrations)}
              icon={UserPlus}
            />
            <StatCard
              label="Daily active users"
              value={formatCount(stats.data.dailyActiveUsers)}
              icon={UserCheck}
              hint="Signed in within 24h"
            />
            <StatCard
              label="Monthly active users"
              value={formatCount(stats.data.monthlyActiveUsers)}
              icon={CalendarClock}
              hint="Signed in within 30d"
            />
          </DashboardGrid>
        </section>
      ) : null}
    </div>
  );
});
