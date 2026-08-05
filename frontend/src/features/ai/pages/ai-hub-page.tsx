import { QCard } from '@qalam/ui';
import { Gauge, Library, MessageSquare, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { useAiFeatures } from '../hooks/use-ai-meta';

/**
 * The AI hub (`/settings/ai`, W8) — the entry point for the three surfaces W8 adds.
 *
 * **Why a hub and not three nav entries.** Mobile hangs all three off the editor's AI menu
 * (`editor_screen.dart:442-446`), which is right for a phone where the editor is the whole screen.
 * Web already has a home for account-scoped management surfaces, and Billing set the pattern: one
 * settings-nav entry per section, sub-pages reached from the hub. Copying mobile's shape here would
 * mean burying three routes in an editor menu on a client whose editor is one route of many, and it
 * would leave them unreachable to a reader who is not currently writing.
 *
 * The in-editor assistant (W2) stays where it is and is linked from here rather than moved: it needs
 * the manuscript, and these three do not.
 *
 * Registered unconditionally. There is no `VITE_ENABLE_AI` kill switch — the master AI flag is the
 * server's (`GET /ai/features`) — so this page reports what that flag says instead of hiding itself
 * and leaving a bookmarked URL to 404. It is deliberately NOT gated on any premium feature: per
 * docs/48 §5.2 the backend enforces exactly one (`ai_budget`, in `AiUsageMeterService`), so a client
 * gate on `ai_writing` or the other six would be a wall in front of a route the server serves.
 */
export function AiHubPage(): ReactElement {
  usePageTitle('AI');
  const features = useAiFeatures();
  const disabled = features.data?.aiEnabled === false;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">AI</h2>
        <p className="text-ink-secondary text-sm">
          Your assistant sessions, saved prompts, and what the AI platform has recorded for you.
        </p>
      </section>

      {disabled ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            AI is switched off for this account right now. These pages will fill in once it is on.
          </p>
        </QCard>
      ) : null}

      <nav aria-label="AI sections">
        <ul className="flex flex-col gap-2">
          {NAV.map(({ to, label, description, icon: Icon }) => (
            <QCard as="li" key={to} interactive padding="none">
              <Link
                to={to}
                className="focus-visible:ring-accent flex min-h-14 items-center gap-3 rounded-md px-4 py-3 outline-none focus-visible:ring-2"
              >
                <Icon size={18} strokeWidth={1.5} className="text-ink-muted shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink text-sm font-medium">{label}</span>
                  <span className="text-ink-muted text-xs">{description}</span>
                </span>
              </Link>
            </QCard>
          ))}
        </ul>
      </nav>
    </div>
  );
}

const NAV: readonly { to: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    to: ROUTES.settingsAiConversations,
    label: 'Conversations',
    description: 'Assistant sessions you’ve kept',
    icon: MessageSquare,
  },
  {
    to: ROUTES.settingsAiPrompts,
    label: 'Prompt library',
    description: 'Starting points, saved on this device',
    icon: Library,
  },
  {
    to: ROUTES.settingsAiUsage,
    label: 'Token usage',
    description: 'Tokens, requests and caps',
    icon: Gauge,
  },
  {
    to: ROUTES.write,
    label: 'Write with the assistant',
    description: 'The in-editor assistant and Craft Coach',
    icon: PenLine,
  },
];
