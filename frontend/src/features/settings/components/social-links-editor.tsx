import { MAX_SOCIAL_LINKS } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useFieldArray, type Control } from 'react-hook-form';

import { FormInput } from '@/components/form';

import type { ProfileFormInput } from '../schemas/profile.schema';

/**
 * Editable social links (docs/06 §3.8) — a `platform → url` map surfaced as an add/remove row
 * list (RHF `useFieldArray`), capped at MAX_SOCIAL_LINKS (8). Each row's inputs carry an
 * `aria-label` (no floating labels — RTL/Nastaliq, docs/33 §5); the URL field is forced LTR.
 * Converted to a record on submit; an empty list clears all links.
 */
export function SocialLinksEditor({
  control,
}: {
  control: Control<ProfileFormInput>;
}): ReactElement {
  const { fields, append, remove } = useFieldArray({ control, name: 'socialLinks' });
  const atLimit = fields.length >= MAX_SOCIAL_LINKS;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-ink">Social links</legend>
      {fields.length === 0 ? (
        <p className="text-xs text-ink-muted">Add links to where readers can find you.</p>
      ) : null}

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <div className="w-28 shrink-0 sm:w-32">
            <FormInput
              control={control}
              name={`socialLinks.${index}.platform`}
              placeholder="Twitter"
              aria-label={`Platform for link ${String(index + 1)}`}
            />
          </div>
          <div className="flex-1">
            <FormInput
              control={control}
              name={`socialLinks.${index}.url`}
              placeholder="https://…"
              dir="ltr"
              inputMode="url"
              aria-label={`URL for link ${String(index + 1)}`}
            />
          </div>
          <QButton
            variant="ghost"
            size="md"
            icon={Trash2}
            aria-label={`Remove link ${String(index + 1)}`}
            onClick={() => remove(index)}
          />
        </div>
      ))}

      <div>
        <QButton
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={atLimit}
          onClick={() => append({ platform: '', url: '' })}
        >
          Add link
        </QButton>
        {atLimit ? (
          <span className="ms-2 text-xs text-ink-muted">
            Up to {String(MAX_SOCIAL_LINKS)} links.
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}
