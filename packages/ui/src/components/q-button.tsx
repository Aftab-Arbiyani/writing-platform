import { Button } from 'antd';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';

export type QButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type QButtonSize = 'sm' | 'md' | 'lg';

export interface QButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'type' | 'size' | 'icon' | 'variant' | 'color'
> {
  /** Visual weight (docs/07 §7.1). One `primary` per view — the ink stamp. */
  variant?: QButtonVariant;
  /** 32 / 40 / 48 px height via the AntD control-height tokens. */
  size?: QButtonSize;
  /** lucide icon, rendered at 20px / 1.5 stroke; logical position follows `dir`. */
  icon?: LucideIcon;
  iconPosition?: 'start' | 'end';
}

const VARIANT: Record<
  QButtonVariant,
  { type: ComponentProps<typeof Button>['type']; danger?: boolean }
> = {
  primary: { type: 'primary' },
  secondary: { type: 'default' },
  ghost: { type: 'text' },
  danger: { type: 'primary', danger: true },
};

const SIZE: Record<QButtonSize, ComponentProps<typeof Button>['size']> = {
  sm: 'small',
  md: 'middle',
  lg: 'large',
};

/** Token-themed button wrapping AntD `Button` (docs/07 §7.1, docs/08 §2). */
export function QButton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconPosition = 'start',
  ...rest
}: QButtonProps): ReactElement {
  const { type, danger } = VARIANT[variant];
  return (
    <Button
      type={type}
      danger={danger}
      size={SIZE[size]}
      iconPosition={iconPosition}
      icon={Icon ? <Icon size={20} strokeWidth={1.5} aria-hidden /> : undefined}
      {...rest}
    />
  );
}
