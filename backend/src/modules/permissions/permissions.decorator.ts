import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { PermissionCode } from '@qalam/shared';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import { PermissionGuard } from './permission.guard';

/**
 * Declares the permission(s) a route requires (PBAC). Replaces `@Roles(...)`.
 * Bundles three things so a route is protected with one decorator:
 *  1. the required-permission metadata (`PermissionGuard` reads it),
 *  2. `@UseGuards(PermissionGuard)` so the guard actually runs (after the global
 *     `JwtAuthGuard`), and
 *  3. an OpenAPI `x-required-permissions` extension so Swagger documents the
 *     requirement for every protected endpoint.
 *
 * ALL listed permissions are required (AND). Wildcards are honored on the GRANT
 * side, not here — routes declare concrete codes.
 *
 * ```ts
 * @Permissions(PERMISSIONS.PiecePublish)
 * @Post('pieces/:id/publish')
 * ```
 */
export function Permissions(...codes: PermissionCode[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, codes),
    UseGuards(PermissionGuard),
    ApiExtension('x-required-permissions', codes),
  );
}
