import { Avatar } from 'antd';
import type { ComponentProps, ReactElement } from 'react';

export interface QAvatarProps extends Omit<ComponentProps<typeof Avatar>, 'size'> {
  /** 32 / 48 / 80 px (docs/07), or an explicit pixel size. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Used for the initial fallback + as the accessible name when there is no image. */
  name?: string;
}

const SIZE: Record<'sm' | 'md' | 'lg', number> = { sm: 32, md: 48, lg: 80 };

/** Avatar wrapping AntD `Avatar`; falls back to the first initial of `name`. */
export function QAvatar({ size = 'md', name, children, ...rest }: QAvatarProps): ReactElement {
  const px = typeof size === 'number' ? size : SIZE[size];
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <Avatar size={px} alt={name} {...rest}>
      {children ?? initial}
    </Avatar>
  );
}
