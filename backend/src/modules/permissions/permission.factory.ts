import { Injectable } from '@nestjs/common';
import { permissionSatisfies } from '@qalam/shared';

/**
 * The permission-matching engine (PBAC). Builds permission sets and evaluates a
 * required code against a granted set with wildcard support (`*`, `module.*`) —
 * delegating the pure rule to `@qalam/shared` so backend and clients agree.
 * Injectable so the guard and any service can share one matcher.
 */
@Injectable()
export class PermissionFactory {
  /** Materializes a grant list into a lookup set. */
  buildSet(grants: Iterable<string>): Set<string> {
    return new Set(grants);
  }

  /** Whether the granted set satisfies a single required permission. */
  satisfies(granted: ReadonlySet<string>, required: string): boolean {
    return permissionSatisfies(granted, required);
  }

  /** Whether the granted set satisfies EVERY required permission (AND semantics). */
  satisfiesAll(granted: ReadonlySet<string>, required: readonly string[]): boolean {
    return required.every((code) => permissionSatisfies(granted, code));
  }

  /** The subset of required permissions the granted set does NOT satisfy. */
  missing(granted: ReadonlySet<string>, required: readonly string[]): string[] {
    return required.filter((code) => !permissionSatisfies(granted, code));
  }
}
