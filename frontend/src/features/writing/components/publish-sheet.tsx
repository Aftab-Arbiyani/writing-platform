import { zodResolver } from '@hookform/resolvers/zod';
import { ERROR_CODES, TAGS_MAX_PER_PIECE, Visibility } from '@qalam/shared';
import { QButton, QDrawer, QSelect } from '@qalam/ui';
import { Radio } from 'antd';
import { useState, type ReactElement } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';

import { FormCheckbox, FormError, FormInput } from '@/components/form';
import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { useBreakpoint } from '@/hooks/use-breakpoint';

import { useGenres, useLanguages } from '../hooks/use-taxonomy';
import { usePublishPiece, useSchedulePiece } from '../hooks/use-publish';
import { publishSchema, type PublishInput } from '../schemas/publish.schema';
import type { Piece, UpdatePiecePayload } from '../types/piece.types';
import { CoverUploader } from './cover-uploader';

const pad = (n: number): string => String(n).padStart(2, '0');
/** ISO → value for a native datetime-local input (local wall-clock). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Maps publish-time server errors (details are plain field names for PIECE_INCOMPLETE). */
function applyPublishError(error: unknown, form: UseFormReturn<PublishInput>): void {
  if (!(error instanceof ApiError)) {
    form.setError('root.server', { message: messageFor('API_UNEXPECTED_ERROR') });
    return;
  }
  if (error.code === ERROR_CODES.PIECE_INCOMPLETE) {
    const missing = error.details.filter((d): d is string => typeof d === 'string');
    if (missing.includes('title'))
      form.setError('title', { type: 'server', message: 'A title is required.' });
    if (missing.includes('genre'))
      form.setError('genreSlug', { type: 'server', message: 'Choose a genre.' });
    if (missing.includes('content')) {
      form.setError('root.server', {
        type: 'server',
        message: 'Add some words before publishing.',
      });
    }
    return;
  }
  if (error.code === ERROR_CODES.PIECE_SCHEDULE_IN_PAST) {
    form.setError('scheduledAt', { type: 'server', message: messageFor(error.code) });
    return;
  }
  form.setError('root.server', { type: 'server', message: messageFor(error.code) });
}

/**
 * Publish sheet (docs/06 §3.4) — a right-side sheet (bottom on mobile), focus-trapped by AntD.
 * The publish/schedule endpoints take no metadata, so submit PATCHes the sheet's fields then
 * calls publish (idempotent) or schedule. RHF + Zod; server errors map inline / to a banner.
 */
export function PublishSheet({
  piece,
  onClose,
  onDone,
}: {
  piece: Piece;
  onClose: () => void;
  onDone: (piece: Piece, scheduled: boolean) => void;
}): ReactElement {
  const { isMobile } = useBreakpoint();
  const languages = useLanguages();
  const genres = useGenres();
  const publish = usePublishPiece();
  const schedule = useSchedulePiece();
  const [coverKey, setCoverKey] = useState<string | null>(piece.coverImageKey);

  const form = useForm<PublishInput>({
    resolver: zodResolver(publishSchema),
    mode: 'onTouched',
    defaultValues: {
      title: piece.title,
      subtitle: piece.subtitle ?? '',
      featuredQuote: piece.featuredQuote ?? '',
      languageCode: piece.language?.code ?? '',
      genreSlug: piece.genre?.slug ?? '',
      tags: piece.tags.map((t) => t.name),
      visibility: piece.visibility,
      scheduleEnabled: piece.status === 'scheduled',
      scheduledAt: piece.scheduledAt ? toLocalInput(piece.scheduledAt) : '',
    },
  });

  const scheduleEnabled = form.watch('scheduleEnabled');
  const pending = publish.isPending || schedule.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const patch: UpdatePiecePayload = {
      title: values.title.trim(),
      subtitle: values.subtitle || undefined,
      featuredQuote: values.featuredQuote || undefined,
      languageCode: values.languageCode,
      genreSlug: values.genreSlug,
      tags: values.tags,
      visibility: values.visibility,
    };
    try {
      if (values.scheduleEnabled) {
        const result = await schedule.mutateAsync({
          id: piece.id,
          patch,
          scheduledAt: new Date(values.scheduledAt).toISOString(),
        });
        onDone(result, true);
      } else {
        const result = await publish.mutateAsync({ id: piece.id, patch });
        onDone(result, false);
      }
    } catch (err) {
      applyPublishError(err, form);
    }
  });

  return (
    <QDrawer
      open
      onClose={onClose}
      title="Ready to publish"
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? '100%' : 480}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={form.formState.errors.root?.server?.message} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Cover (optional)</span>
          <CoverUploader pieceId={piece.id} coverKey={coverKey} onUploaded={setCoverKey} />
        </div>

        <FormInput control={form.control} name="title" label="Title" placeholder="Title" />
        <FormInput control={form.control} name="subtitle" label="Subtitle" placeholder="Optional" />
        <FormInput
          control={form.control}
          name="featuredQuote"
          label="Featured quote"
          placeholder="A line to feature (optional)"
        />

        <Controller
          control={form.control}
          name="languageCode"
          render={({ field, fieldState }) => (
            <QSelect
              label="Language"
              placeholder="Choose a language"
              loading={languages.isLoading}
              value={field.value || undefined}
              error={fieldState.error?.message}
              onChange={(value) => {
                field.onChange(typeof value === 'string' ? value : '');
              }}
              options={(languages.data ?? []).map((l) => ({ value: l.code, label: l.nativeName }))}
            />
          )}
        />

        <Controller
          control={form.control}
          name="genreSlug"
          render={({ field, fieldState }) => (
            <QSelect
              label="Genre"
              placeholder="Choose a genre"
              loading={genres.isLoading}
              value={field.value || undefined}
              error={fieldState.error?.message}
              onChange={(value) => {
                field.onChange(typeof value === 'string' ? value : '');
              }}
              options={(genres.data ?? []).map((g) => ({ value: g.slug, label: g.name }))}
            />
          )}
        />

        <Controller
          control={form.control}
          name="tags"
          render={({ field, fieldState }) => (
            <QSelect
              label={`Tags (up to ${String(TAGS_MAX_PER_PIECE)})`}
              mode="tags"
              placeholder="Add tags"
              maxCount={TAGS_MAX_PER_PIECE}
              value={field.value}
              error={fieldState.error?.message}
              onChange={(value) => {
                field.onChange(Array.isArray(value) ? value : []);
              }}
              options={[]}
            />
          )}
        />

        <Controller
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Visibility</span>
              <Radio.Group
                value={field.value}
                onChange={(e) => {
                  field.onChange(e.target.value);
                }}
              >
                <Radio value={Visibility.Public}>Public</Radio>
                <Radio value={Visibility.Unlisted}>Unlisted</Radio>
                <Radio value={Visibility.Private}>Private</Radio>
              </Radio.Group>
            </div>
          )}
        />

        <FormCheckbox control={form.control} name="scheduleEnabled">
          Publish later
        </FormCheckbox>
        {scheduleEnabled ? (
          <Controller
            control={form.control}
            name="scheduledAt"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="scheduledAt" className="text-sm font-medium text-ink">
                  Publish date &amp; time
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
                {fieldState.error ? (
                  <span role="alert" className="text-xs text-danger">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          />
        ) : null}

        <div className="mt-2 flex items-center justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={pending}>
            Back to draft
          </QButton>
          <QButton variant="primary" htmlType="submit" loading={pending}>
            {scheduleEnabled ? 'Schedule' : 'Publish now'}
          </QButton>
        </div>
      </form>
    </QDrawer>
  );
}
