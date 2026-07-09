import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names: clsx (conditional) + tailwind-merge (last-wins conflict resolution),
 * so a consumer's `className` can always override a component's defaults (docs/08 §4 #7).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
