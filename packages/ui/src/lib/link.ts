import type { ComponentType, PropsWithChildren } from 'react';

/**
 * The one navigation seam (docs/08 §3). `@qalam/ui` never imports react-router, so any
 * component that links accepts a `linkComponent` prop; apps pass their router's Link,
 * Storybook/tests pass a plain `<a>`.
 */
export type LinkComponent = ComponentType<
  PropsWithChildren<{ href: string; className?: string; 'aria-label'?: string }>
>;
