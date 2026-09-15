import type { LinkComponent } from '@umberleaf/ui';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

/**
 * Adapter that satisfies `@umberleaf/ui`'s `LinkComponent` seam (docs/08 §3) with react-router's
 * `Link`. `@umberleaf/ui` never imports the router; components that link (e.g. `QTag href=…`)
 * accept this via their `linkComponent` prop.
 */
export const RouterLink: LinkComponent = ({ href, className, children, ...rest }): ReactElement => (
  <Link to={href} className={className} {...rest}>
    {children}
  </Link>
);
