import 'reflect-metadata';
import { PERMISSIONS } from '@qalam/shared';

import { PERMISSIONS_KEY, RATE_LIMIT_KEY } from '../../common/constants/metadata.constants';
import { FeatureFlagsController } from './feature-flags.controller';
import { MaintenanceController } from './maintenance.controller';
import { SettingsController } from './settings.controller';

/** Reads the `@Permissions(...)` codes a route handler declares (PBAC metadata). */
function permsOf(handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler);
}

/** Reads the `@RateLimit(...)` tiers a route handler declares. */
function tiersOf(handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(RATE_LIMIT_KEY, handler);
}

describe('Settings PBAC — every route requires settings.manage', () => {
  const routes: Array<[string, (...args: never[]) => unknown]> = [
    ['settings.getAll', SettingsController.prototype.getAll],
    ['settings.getByCategory', SettingsController.prototype.getByCategory],
    ['settings.update', SettingsController.prototype.update],
    ['settings.updateCategory', SettingsController.prototype.updateCategory],
    ['flags.list', FeatureFlagsController.prototype.list],
    ['flags.create', FeatureFlagsController.prototype.create],
    ['flags.update', FeatureFlagsController.prototype.update],
    ['flags.remove', FeatureFlagsController.prototype.remove],
    ['maintenance.get', MaintenanceController.prototype.get],
    ['maintenance.update', MaintenanceController.prototype.update],
  ];

  it.each(routes)('%s is gated on settings.manage', (_name, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.SettingsManage]);
  });

  it.each(routes)('%s declares a rate-limit tier', (_name, handler) => {
    expect(tiersOf(handler)).toEqual(expect.arrayContaining([expect.any(String)]));
  });
});
