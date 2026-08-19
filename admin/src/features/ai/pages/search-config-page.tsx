import { zodResolver } from '@hookform/resolvers/zod';
import type { UpdateRetrievalAdminConfig } from '@qalam/api-types';
import { PERMISSIONS, RankingSignal, RETRIEVAL_CONFIG_BOUNDS } from '@qalam/shared';
import { QCard, QSectionHeader } from '@qalam/ui';
import { App, Button, InputNumber, Switch } from 'antd';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AccessDenied } from '@/components/access-denied';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { usePermissions } from '@/hooks/use-permissions';

import { AsyncSection } from '../components/async-section';
import { useRetrievalConfig, useUpdateRetrievalConfig } from '../hooks/use-ai';
import { SIGNAL_LABELS, SOURCE_HINTS, SOURCE_LABELS, SOURCE_ORDER } from '../lib/retrieval-labels';
import { retrievalConfigSchema } from '../schemas/retrieval-config.schema';
import type { RetrievalConfigForm } from '../schemas/retrieval-config.schema';

const bounds = RETRIEVAL_CONFIG_BOUNDS;

/**
 * Retrieval configuration (A3) — the search, ranking and budget knobs every AF4 request plans
 * against: `GET`/`PUT /admin/ai/search-config`. Gated on `ai.manage`.
 *
 * **The form is a full snapshot, not a diff.** The endpoint takes a partial patch and merges per
 * key, but the read always answers with every source and every signal, so submitting the whole
 * snapshot is both simpler and safer: a weight cannot go missing because a key was omitted, and
 * what the operator sees is exactly what the next request will plan with.
 *
 * **A weight of 0 disables a signal — it is not "no opinion".** The planner ranks by the signals
 * with a positive weight (`weight > 0`), so zeroing one removes it from ranking and from the
 * explanations users see. The form says so rather than leaving an operator to discover it.
 *
 * Bounds come from `RETRIEVAL_CONFIG_BOUNDS` in `@qalam/shared` — the same constant the DTO
 * validates against — so no control here can offer a value the route refuses.
 */
export function SearchConfigPage(): ReactElement {
  usePageTitle('Retrieval config');
  const { can } = usePermissions();
  const { message } = App.useApp();
  const configQuery = useRetrievalConfig();
  const update = useUpdateRetrievalConfig();

  const form = useForm<RetrievalConfigForm>({
    resolver: zodResolver(retrievalConfigSchema),
  });

  useEffect(() => {
    const config = configQuery.data;
    if (config !== undefined) {
      form.reset({
        topK: config.topK,
        candidatesPerSource: config.candidatesPerSource,
        contextTokens: config.contextTokens,
        timeoutMs: config.timeoutMs,
        sources: config.sources,
        rankingWeights: config.rankingWeights,
        synthesisEnabled: config.synthesisEnabled,
      });
    }
  }, [configQuery.data, form]);

  if (!can(PERMISSIONS.AiManage)) {
    return <AccessDenied />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values satisfies UpdateRetrievalAdminConfig);
      message.success('Retrieval config saved.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save retrieval config.');
    }
  });

  return (
    <PageContainer>
      <PageHeader
        title="Retrieval config"
        description="How AI search, Ask My Book and recommendations plan a request: which sources run, how candidates are ranked, and the budgets each request is held to."
      />

      <AsyncSection
        isLoading={configQuery.isLoading}
        error={configQuery.error}
        onRetry={() => void configQuery.refetch()}
        loadingRows={6}
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <QCard as="section" padding="lg" className="flex flex-col gap-4" data-testid="budgets">
            <QSectionHeader
              title="Budgets"
              description="Per-request limits. Raising them costs latency and tokens on every AI request."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Results per request</span>
                <Controller
                  control={form.control}
                  name="topK"
                  render={({ field }) => (
                    <InputNumber
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      min={bounds.topK.min}
                      max={bounds.topK.max}
                      step={1}
                      className="w-full"
                      aria-label="Results per request"
                    />
                  )}
                />
                <span className="text-xs text-ink-muted">
                  Ranked results returned to a client (topK).
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Candidates per source</span>
                <Controller
                  control={form.control}
                  name="candidatesPerSource"
                  render={({ field }) => (
                    <InputNumber
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      min={bounds.candidatesPerSource.min}
                      max={bounds.candidatesPerSource.max}
                      step={5}
                      className="w-full"
                      aria-label="Candidates per source"
                    />
                  )}
                />
                <span className="text-xs text-ink-muted">Fetched before ranking narrows them.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Context tokens</span>
                <Controller
                  control={form.control}
                  name="contextTokens"
                  render={({ field }) => (
                    <InputNumber
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      min={bounds.contextTokens.min}
                      max={bounds.contextTokens.max}
                      step={100}
                      className="w-full"
                      aria-label="Context tokens"
                    />
                  )}
                />
                <span className="text-xs text-ink-muted">
                  Token budget for the context handed to the model.
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Retrieval timeout (ms)</span>
                <Controller
                  control={form.control}
                  name="timeoutMs"
                  render={({ field }) => (
                    <InputNumber
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      min={bounds.timeoutMs.min}
                      max={bounds.timeoutMs.max}
                      step={500}
                      className="w-full"
                      aria-label="Retrieval timeout in milliseconds"
                    />
                  )}
                />
                <span className="text-xs text-ink-muted">
                  After this the plan degrades rather than waits.
                </span>
              </label>
            </div>
          </QCard>

          <QCard as="section" padding="lg" className="flex flex-col gap-4" data-testid="sources">
            <QSectionHeader
              title="Sources"
              description="Which retrieval strategies the planner composes, in the order it runs them."
            />
            <ul className="flex flex-col divide-y divide-line">
              {SOURCE_ORDER.map((source) => (
                <li key={source} className="flex items-start justify-between gap-4 py-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-ink">{SOURCE_LABELS[source]}</span>
                    <span className="text-xs text-ink-muted">{SOURCE_HINTS[source]}</span>
                  </span>
                  <Controller
                    control={form.control}
                    name={`sources.${source}`}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                        aria-label={SOURCE_LABELS[source]}
                      />
                    )}
                  />
                </li>
              ))}
            </ul>
          </QCard>

          <QCard as="section" padding="lg" className="flex flex-col gap-4" data-testid="ranking">
            <QSectionHeader
              title="Ranking weights"
              description="How much each signal counts when candidates are ordered. 0 removes the signal from ranking entirely."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.values(RankingSignal).map((signal) => (
                <label key={signal} className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-ink">{SIGNAL_LABELS[signal]}</span>
                  <Controller
                    control={form.control}
                    name={`rankingWeights.${signal}`}
                    render={({ field }) => (
                      <InputNumber
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        min={bounds.rankingWeight.min}
                        max={bounds.rankingWeight.max}
                        step={0.05}
                        className="w-full"
                        aria-label={`${SIGNAL_LABELS[signal]} weight`}
                      />
                    )}
                  />
                </label>
              ))}
            </div>
          </QCard>

          <QCard as="section" padding="lg" className="flex flex-col gap-4" data-testid="synthesis">
            <QSectionHeader
              title="Synthesis"
              description="Whether search may offer a grounded, cited answer above its results."
            />
            <label className="flex items-center gap-3">
              <Controller
                control={form.control}
                name="synthesisEnabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    aria-label="Synthesis enabled"
                  />
                )}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">Allow synthesis on search</span>
                <span className="text-xs text-ink-muted">
                  Ask My Book always synthesises; this governs search, and only when the client asks
                  for it.
                </span>
              </span>
            </label>
          </QCard>

          <QCard as="section" padding="lg" className="flex flex-col gap-2">
            <QSectionHeader title="Reading these settings" />
            <p className="text-sm text-ink-secondary">
              Changes are written through the audited settings path and apply to the{' '}
              <strong>next</strong> request &mdash; nothing already answered or cached is
              recomputed.
            </p>
            <p className="text-sm text-ink-secondary">
              A weight of <strong>0</strong> disables its signal rather than treating it neutrally,
              so zeroing several at once narrows what ranking can consider &mdash; and with every
              weight at 0 candidates keep the order their source returned them in.
            </p>
          </QCard>

          <div>
            <Button type="primary" htmlType="submit" loading={update.isPending}>
              Save config
            </Button>
          </div>
        </form>
      </AsyncSection>
    </PageContainer>
  );
}
