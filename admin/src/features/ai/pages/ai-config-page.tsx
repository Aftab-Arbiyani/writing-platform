import { zodResolver } from '@hookform/resolvers/zod';
import { AiProvider, IMPLEMENTED_AI_PROVIDERS, PERMISSIONS } from '@qalam/shared';
import { App, Button, Card, InputNumber, Select, Switch } from 'antd';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AccessDenied } from '@/components/access-denied';
import { LoadingState } from '@/components/loading-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePermissions } from '@/hooks/use-permissions';

import { useAiModels, useAiOrgConfig, useUpdateAiOrgConfig } from '../hooks/use-ai';
import { aiOrgConfigSchema } from '../schemas/ai-config.schema';
import type { AiOrgConfigForm } from '../schemas/ai-config.schema';

/**
 * Only providers with a shipped adapter are offered (AI-3, docs/48 §3.22b).
 *
 * This used to be `Object.values(AiProvider)`, i.e. **nine** options for **three** working ones — an
 * operator could select `ollama`, `openrouter`, `lm_studio`, `self_hosted` or `stub` and save it,
 * and every subsequent AI call would fail against a provider with no adapter behind it. That is also
 * what made `IMPLEMENTED_AI_PROVIDERS` a dead export: the list existed and nothing consulted it.
 *
 * `stub` is excluded on purpose even though it HAS an adapter — its own docblock in `@qalam/shared`
 * says why: it is a test-stack path gated on `AI_STUB_ENABLED`, and offering it in a production admin
 * UI is how every writer's suggestion becomes the same canned paragraph.
 */
const PROVIDER_OPTIONS = IMPLEMENTED_AI_PROVIDERS.map((value) => ({ value, label: value }));

/**
 * Keeps a STORED provider selectable even when it is not implemented.
 *
 * Narrowing the list is a refusal to offer a broken choice, not a licence to silently drop one an
 * operator already saved: a deployment whose config says `ollama` must still round-trip, or opening
 * this page and pressing Save would rewrite their provider to whatever the Select fell back to. The
 * stray value is labelled rather than hidden, so the reason it is flagged is on screen.
 */
function providerOptions(stored: string | undefined) {
  if (stored === undefined || IMPLEMENTED_AI_PROVIDERS.includes(stored as AiProvider)) {
    return PROVIDER_OPTIONS;
  }
  return [...PROVIDER_OPTIONS, { value: stored, label: `${stored} (no adapter shipped)` }];
}

const DEFAULTS: AiOrgConfigForm = {
  provider: AiProvider.OpenAI,
  model: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: 1024,
  streaming: true,
};

/**
 * Organization AI defaults (AF1) — the admin org-level baseline every AI call
 * inherits (users may override their own). Feature ON/OFF flags are managed in
 * Settings → Feature Flags (the seeded `feature.ai.*` flags), so they are not
 * duplicated here. Gated on `ai.manage`.
 */
export function AiConfigPage(): ReactElement {
  const { can } = usePermissions();
  const { message } = App.useApp();
  const configQuery = useAiOrgConfig();
  const modelsQuery = useAiModels();
  const update = useUpdateAiOrgConfig();

  const form = useForm<AiOrgConfigForm>({
    resolver: zodResolver(aiOrgConfigSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    const config = configQuery.data;
    if (config !== undefined) {
      form.reset({
        provider: config.provider,
        model: config.model,
        temperature: config.params.temperature ?? DEFAULTS.temperature,
        topP: config.params.topP ?? DEFAULTS.topP,
        maxTokens: config.params.maxTokens ?? DEFAULTS.maxTokens,
        streaming: config.streaming,
      });
    }
  }, [configQuery.data, form]);

  if (!can(PERMISSIONS.AiManage)) {
    return <AccessDenied />;
  }

  const selectedProvider = form.watch('provider');
  const modelOptions = [
    { value: '', label: '(provider default)' },
    ...(modelsQuery.data ?? [])
      .filter((model) => model.provider === selectedProvider)
      .map((model) => ({ value: model.id, label: model.displayName })),
  ];

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        provider: values.provider as AiProvider,
        model: values.model,
        params: {
          temperature: values.temperature,
          topP: values.topP,
          maxTokens: values.maxTokens,
        },
        streaming: values.streaming,
        safety: configQuery.data?.safety ?? {},
      });
      message.success('AI defaults saved.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save AI defaults.');
    }
  });

  return (
    <PageContainer>
      <PageHeader
        title="AI Defaults"
        description="Organization-wide AI provider, model, and generation defaults."
      />
      {configQuery.isLoading ? (
        <LoadingState />
      ) : (
        <Card>
          <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Provider</span>
              <Controller
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <Select
                    {...field}
                    options={providerOptions(configQuery.data?.provider)}
                    aria-label="Provider"
                  />
                )}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Default model</span>
              <Controller
                control={form.control}
                name="model"
                render={({ field }) => (
                  <Select {...field} options={modelOptions} aria-label="Default model" />
                )}
              />
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Temperature</span>
                <Controller
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <InputNumber {...field} min={0} max={2} step={0.1} aria-label="Temperature" />
                  )}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Top P</span>
                <Controller
                  control={form.control}
                  name="topP"
                  render={({ field }) => (
                    <InputNumber {...field} min={0} max={1} step={0.05} aria-label="Top P" />
                  )}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Max tokens</span>
                <Controller
                  control={form.control}
                  name="maxTokens"
                  render={({ field }) => (
                    <InputNumber {...field} min={1} max={32768} step={64} aria-label="Max tokens" />
                  )}
                />
              </label>
            </div>

            <label className="flex items-center gap-3">
              <Controller
                control={form.control}
                name="streaming"
                render={({ field }) => (
                  <Switch checked={field.value} onChange={field.onChange} aria-label="Streaming" />
                )}
              />
              <span className="text-sm font-medium text-ink">Streaming enabled by default</span>
            </label>

            <div>
              <Button type="primary" htmlType="submit" loading={update.isPending}>
                Save defaults
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PageContainer>
  );
}
