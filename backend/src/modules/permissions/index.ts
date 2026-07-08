/**
 * Public surface of the permissions (PBAC) module. Controllers import
 * `Permissions` to protect routes; other modules rarely need the rest.
 */
export { PermissionsModule } from './permissions.module';
export { Permissions } from './permissions.decorator';
export { PermissionGuard } from './permission.guard';
export { PermissionResolver } from './permission.resolver';
export { PermissionFactory } from './permission.factory';
export { PermissionsService } from './permissions.service';
