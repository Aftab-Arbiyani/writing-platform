import { Input, InputNumber, Select, Switch } from 'antd';
import type { ReactElement } from 'react';

import type { Setting } from '../types/settings.types';

interface SettingFieldProps {
  setting: Setting;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  id?: string;
}

/** Title-cases an enum/array member for display (`super_admin` → `Super admin`). */
function optionLabel(value: string): string {
  const words = value.replace(/[._-]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toOptions(values: string[]): { label: string; value: string }[] {
  return values.map((value) => ({ label: optionLabel(value), value }));
}

/**
 * Renders the correct input control for a setting based on its `dataType` +
 * validation rules (A7 — the reusable field that makes the Settings Form
 * data-driven). A non-editable (infra-managed) setting renders disabled.
 */
export function SettingField({
  setting,
  value,
  onChange,
  disabled = false,
  id,
}: SettingFieldProps): ReactElement {
  const rules = setting.validationRules;
  const isDisabled = disabled || !setting.editable;

  switch (setting.dataType) {
    case 'boolean':
      return (
        <Switch
          id={id}
          checked={value === true}
          onChange={onChange}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      );

    case 'number':
      return (
        <InputNumber
          id={id}
          className="w-full"
          value={typeof value === 'number' ? value : null}
          onChange={(next) => onChange(next)}
          min={rules.min}
          max={rules.max}
          step={rules.integer ? 1 : undefined}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      );

    case 'enum':
      return (
        <Select
          id={id}
          className="w-full"
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          options={toOptions(rules.enum ?? [])}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      );

    case 'array': {
      const allowed = rules.enum;
      const arrayValue = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Select
          id={id}
          className="w-full"
          mode={allowed !== undefined && allowed.length > 0 ? 'multiple' : 'tags'}
          value={arrayValue}
          onChange={onChange}
          options={allowed !== undefined ? toOptions(allowed) : undefined}
          disabled={isDisabled}
          maxCount={rules.maxItems}
          aria-label={setting.key}
          placeholder="Add values…"
        />
      );
    }

    case 'json':
      return (
        <Input.TextArea
          id={id}
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      );

    case 'string':
    default: {
      const long = (rules.maxLength ?? 0) > 120;
      const stringValue = typeof value === 'string' ? value : '';
      return long ? (
        <Input.TextArea
          id={id}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          maxLength={rules.maxLength}
          rows={3}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      ) : (
        <Input
          id={id}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          maxLength={rules.maxLength}
          disabled={isDisabled}
          aria-label={setting.key}
        />
      );
    }
  }
}
