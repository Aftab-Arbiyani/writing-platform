import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import type { Role } from '@qalam/shared';

import { ROLES_KEY } from '../../../common/constants/metadata.constants';

/**
 * Declares the **minimum** role for a route (docs 13 §4.3). `RolesGuard`
 * compares by rank, so `@Roles(Role.Moderator)` also admits `admin`/`super_admin`.
 * Pair with `@UseGuards(JwtAuthGuard, RolesGuard)`.
 */
export function Roles(...roles: Role[]): CustomDecorator<string> {
  return SetMetadata(ROLES_KEY, roles);
}
