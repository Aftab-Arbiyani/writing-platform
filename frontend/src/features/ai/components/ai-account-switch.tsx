import { QCard } from '@qalam/ui';
import { Switch } from 'antd';
import type { ReactElement } from 'react';

import { useAiPreference, useSetAiPreference } from '@/hooks/use-ai-preference';

/**
 * B5 (docs/45 §4.10) — the author's own "turn AI off" switch, on the AI hub.
 *
 * **This is not a client-side hide.** Turning it off writes `user_settings.ai_enabled`,
 * after which the SERVER refuses this account's AI requests (`AI_DISABLED_BY_USER`) and
 * `GET /ai/features` reports every feature off. Every AI affordance in the app already
 * gates on that response, so they disappear because the server says so — which is the
 * whole point: a UI-only hide is the defect class W3c-1 and docs/48 §5.2 record.
 *
 * **It governs this account, not any story.** A co-author who has AI on may still use it
 * on a story this writer co-authors; this switch only decides what is offered *here*.
 *
 * **Deliberately NOT the `ai_personalization` consent.** That consent (`PUT /privacy/consent`,
 * `privacy.constants.ts`) answers "may my work be used to improve AI"; this switch answers
 * "offer me the tools at all". They are independent choices — a writer may want the
 * assistant without the training, or the reverse — so §4.10 requires they sit beside each
 * other rather than merged, and that the difference be legible to a non-technical writer.
 * The explanatory line below is that requirement, not decoration.
 *
 * > **Note for whoever surfaces the consent.** The `ai_personalization` consent has NO client
 * > UI on either platform today (`GET/PUT /privacy/consent` ships with no web and no mobile
 * > surface — verified 2026-08-08), so there is nothing on this page to sit "next to" yet.
 * > When it gains one, it belongs here, as a sibling row — and the copy below already draws
 * > the line so the two cannot be read as the same setting.
 */
export function AiAccountSwitch(): ReactElement {
  const settings = useAiPreference();
  const setPreference = useSetAiPreference();

  // Optimistic while a save is in flight, so the switch moves under the finger rather than
  // waiting on the round trip; the mutation primes the cache from the server's response.
  const checked = setPreference.isPending
    ? setPreference.variables
    : (settings.data?.aiEnabled ?? true);

  return (
    <QCard as="section">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-ink text-sm font-medium">Use AI on this account</h3>
          <p className="text-ink-secondary text-sm">
            When this is off, Qalam stops offering you AI anywhere — no writing assistant, no Craft
            Coach, and no AI search or recommendations. Your writing is unaffected, and you can turn
            it back on at any time.
          </p>
          {/*
            The distinction §4.10 requires, in a writer's words rather than the codebase's:
            "offer me the tools" vs "train on my work". Without it the two settings read as
            one, and a writer who wants the assistant but not the training has no way to tell
            which switch does which.
          */}
          <p className="text-ink-muted text-xs">
            This is separate from whether your work may be used to improve AI features — that is a
            privacy consent you control on its own.
          </p>
        </div>
        <Switch
          checked={checked}
          loading={settings.isPending || setPreference.isPending}
          disabled={settings.isPending}
          aria-label="Use AI on this account"
          onChange={(next) => {
            setPreference.mutate(next);
          }}
        />
      </div>
      {setPreference.isError ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          That didn’t save. Your AI setting is unchanged — try again.
        </p>
      ) : null}
    </QCard>
  );
}
