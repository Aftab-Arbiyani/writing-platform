import { zodResolver } from '@hookform/resolvers/zod';
import { BIO_MAX, LOCATION_MAX, MAX_GENRES_PER_PROFILE } from '@qalam/shared';
import { QErrorState, QSelect, QSpinner, useToast } from '@qalam/ui';
import { Switch } from 'antd';
import { Lock } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormError, FormInput, FormTextArea } from '@/components/form';
import { useMe } from '@/hooks/use-me';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import type { ProfileResponse, UpdateProfilePayload } from '@/types/profile';

import { AvatarUploader } from '../components/avatar-uploader';
import { CoverUploader } from '../components/cover-uploader';
import { SaveBar } from '../components/save-bar';
import { SocialLinksEditor } from '../components/social-links-editor';
import { useUpdateProfile } from '../hooks/use-profile-settings';
import { useGenreOptions, useLanguageOptions } from '../hooks/use-taxonomy';
import { profileSchema, type ProfileFormInput } from '../schemas/profile.schema';
import type { TaxonomyLanguage } from '../types/settings.types';

const EMPTY: ProfileFormInput = {
  penName: '',
  bio: '',
  location: '',
  websiteUrl: '',
  isPrivate: false,
  defaultLanguageCode: '',
  genres: [],
  socialLinks: [],
};

/** Build form defaults from the loaded profile, resolving the language UUID → code via the list. */
function toDefaults(profile: ProfileResponse, languages: TaxonomyLanguage[]): ProfileFormInput {
  const languageCode =
    languages.find((language) => language.id === profile.defaultLanguageId)?.code ?? '';
  return {
    penName: profile.penName,
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    isPrivate: profile.isPrivate,
    defaultLanguageCode: languageCode,
    genres: (profile.genres ?? []).map((genre) => genre.slug),
    socialLinks: Object.entries(profile.socialLinks ?? {}).map(([platform, url]) => ({
      platform,
      url,
    })),
  };
}

/**
 * Edit Profile (`/settings/profile`) — `PATCH /me` + avatar/cover uploads (docs/06 §3.8,
 * docs/26 §9). RHF + Zod (`onTouched`), server errors mapped inline. Uploads are immediate and
 * separate; the rest saves via a sticky Save bar on a dirty form. `defaultLanguageId` (a UUID on
 * the response) is resolved to a `code` from the taxonomy list for the picker. Partial-update
 * semantics: bio/location/genres/socialLinks clear when emptied; `websiteUrl` cannot be cleared
 * in `v1` (docs/32 §11) so an empty value is simply not sent.
 */
export function EditProfilePage(): ReactElement {
  usePageTitle('Edit profile');
  const toast = useToast();
  const me = useMe();
  const languages = useLanguageOptions();
  const genres = useGenreOptions();
  const update = useUpdateProfile();

  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control, handleSubmit, reset, watch, formState } = form;

  // Seed the form once the profile + language list are both available (reset → not dirty).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready && me.data && languages.data) {
      reset(toDefaults(me.data, languages.data));
      setReady(true);
    }
  }, [ready, me.data, languages.data, reset]);

  if (me.isError) {
    return (
      <QErrorState
        title="Couldn’t load your profile."
        description={getErrorMessage(me.error)}
        requestId={getRequestId(me.error)}
        onRetry={() => {
          void me.refetch();
        }}
      />
    );
  }

  if (!ready || !me.data) {
    return (
      <div role="status" aria-label="Loading your profile" className="flex justify-center py-16">
        <QSpinner />
      </div>
    );
  }

  const onSubmit = handleSubmit((values) => {
    const payload: UpdateProfilePayload = {
      penName: values.penName.trim(),
      bio: values.bio,
      location: values.location,
      isPrivate: values.isPrivate,
      genres: values.genres,
      socialLinks: Object.fromEntries(
        values.socialLinks.map((link) => [link.platform.trim(), link.url.trim()]),
      ),
    };
    const website = values.websiteUrl.trim();
    if (website) payload.websiteUrl = website;
    if (values.defaultLanguageCode) payload.defaultLanguageCode = values.defaultLanguageCode;

    update.mutate(payload, {
      onSuccess: (updated) => {
        toast.success('Profile saved');
        reset(toDefaults(updated, languages.data ?? []));
      },
      onError: (err) => {
        applyServerErrors(err, form);
        toast.error('Couldn’t save your profile', { description: getErrorMessage(err) });
      },
    });
  });

  const isPrivate = watch('isPrivate');

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <h2 className="sr-only">Edit profile</h2>

      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink">Cover image</span>
        <CoverUploader coverKey={me.data.coverKey ?? null} />
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink">Avatar</span>
        <AvatarUploader avatarKey={me.data.avatarKey} />
        <p dir="ltr" className="flex items-center gap-1 text-xs text-ink-muted">
          <Lock size={12} strokeWidth={1.5} aria-hidden />
          <bdi>@{me.data.username}</bdi> · usernames are permanent
        </p>
      </section>

      <FormInput
        control={control}
        name="penName"
        label="Pen name"
        placeholder="The name readers see"
        dir="auto"
        autoComplete="name"
      />

      <FormTextArea
        control={control}
        name="bio"
        label="Bio"
        rows={4}
        maxLength={BIO_MAX}
        showCount
        placeholder="A line or two about your writing"
      />

      <FormInput
        control={control}
        name="location"
        label="Location"
        maxLength={LOCATION_MAX}
        dir="auto"
        placeholder="City, country"
      />

      <FormInput
        control={control}
        name="websiteUrl"
        label="Website"
        dir="ltr"
        inputMode="url"
        placeholder="https://your-site.com"
      />

      {/* Preferred compose language (single). Options browse-sourced from the taxonomy. */}
      <Controller
        control={control}
        name="defaultLanguageCode"
        render={({ field, fieldState }) => (
          <QSelect
            label="Preferred language"
            hint="Your default language when you start a new piece."
            error={fieldState.error?.message}
            value={field.value || undefined}
            onChange={(value) => field.onChange(typeof value === 'string' ? value : '')}
            onBlur={field.onBlur}
            loading={languages.isLoading}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Choose a language"
            options={(languages.data ?? []).map((language) => ({
              label: `${language.nativeName} (${language.nameEn})`,
              value: language.code,
            }))}
          />
        )}
      />

      {/* Genres (multiple, ≤5). */}
      <Controller
        control={control}
        name="genres"
        render={({ field, fieldState }) => (
          <QSelect
            label="Genres"
            hint={`Up to ${String(MAX_GENRES_PER_PROFILE)} — what you love to write.`}
            error={fieldState.error?.message}
            mode="multiple"
            maxCount={MAX_GENRES_PER_PROFILE}
            value={field.value}
            onChange={(value) => field.onChange(Array.isArray(value) ? value : [])}
            onBlur={field.onBlur}
            loading={genres.isLoading}
            showSearch
            optionFilterProp="label"
            placeholder="Choose your genres"
            options={(genres.data ?? []).map((genre) => ({ label: genre.name, value: genre.slug }))}
          />
        )}
      />

      <SocialLinksEditor control={control} />

      {/* Privacy (account-level; toggling to private shows the follow-request explainer). */}
      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">Private notebook</span>
            <span className="text-xs text-ink-muted">
              Only approved followers can read your pieces and see your lists.
            </span>
          </span>
          <Controller
            control={control}
            name="isPrivate"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                aria-label="Private notebook"
              />
            )}
          />
        </div>
        {isPrivate ? (
          <p className="rounded-md bg-raised p-3 text-xs text-ink-secondary" role="status">
            New followers will have to send a request you approve. Existing followers keep their
            access.
          </p>
        ) : null}
      </section>

      <FormError message={formState.errors.root?.server?.message} />

      <SaveBar visible={formState.isDirty} isSaving={update.isPending} onDiscard={() => reset()} />
    </form>
  );
}
