import { zodResolver } from '@hookform/resolvers/zod';
import { AiProvider, PERMISSIONS } from '@qalam/shared';
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

const PROVIDER_OPTIONS = Object.values(AiProvider).map((value) => ({ value, label: value }));

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
                  <Select {...field} options={PROVIDER_OPTIONS} aria-label="Provider" />
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
