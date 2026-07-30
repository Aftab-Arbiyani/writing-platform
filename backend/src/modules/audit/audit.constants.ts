/**
 * Audit vocabulary (docs 13 §11). Action codes are dot-cased `target.verb`
 * strings persisted verbatim in `audit_logs.action`; the category map lets the
 * admin UI group a user's trail into Status / Role / Security / Administrative
 * without the client hard-coding the mapping.
 */

/** Entity kinds an audit entry can target (E12.5 covers users only). */
export const AUDIT_TARGET = {
  User: 'user',
} as const;
export type AuditTarget = (typeof AUDIT_TARGET)[keyof typeof AUDIT_TARGET];

/** Every admin action E12.5 records. Stable strings — clients may switch on them. */
export const AUDIT_ACTIONS = {
  UserUpdate: 'user.update',
  UserVerify: 'user.verify',
  UserUnverify: 'user.unverify',
  UserSuspend: 'user.suspend',
  UserUnsuspend: 'user.unsuspend',
  UserDeactivate: 'user.deactivate',
  UserReactivate: 'user.reactivate',
  UserResetPassword: 'user.reset_password',
  UserForceLogout: 'user.force_logout',
  UserRoleChange: 'user.role_change',
  UserExport: 'user.export',
  UserBulkAction: 'user.bulk_action',
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** How the admin UI buckets a trail entry (docs "Audit History" section). */
export const AUDIT_CATEGORY = {
  Status: 'status',
  Role: 'role',
  Security: 'security',
  Privacy: 'privacy',
  Administrative: 'administrative',
} as const;
export type AuditCategory = (typeof AUDIT_CATEGORY)[keyof typeof AUDIT_CATEGORY];

/**
 * Derives the display category from an action code (unknown → administrative).
 * P7.2 security/privacy dot-namespaces are bucketed by prefix so the Security
 * Platform can add action codes without editing this map.
 */
export function auditCategoryOf(action: string): AuditCategory {
  if (/^(auth|authz|security|threat)\./.test(action)) {
    return AUDIT_CATEGORY.Security;
  }
  if (/^(privacy|compliance|data)\./.test(action)) {
    return AUDIT_CATEGORY.Privacy;
  }
  switch (action) {
    case AUDIT_ACTIONS.UserSuspend:
    case AUDIT_ACTIONS.UserUnsuspend:
    case AUDIT_ACTIONS.UserDeactivate:
    case AUDIT_ACTIONS.UserReactivate:
      return AUDIT_CATEGORY.Status;
    case AUDIT_ACTIONS.UserRoleChange:
      return AUDIT_CATEGORY.Role;
    case AUDIT_ACTIONS.UserResetPassword:
    case AUDIT_ACTIONS.UserForceLogout:
      return AUDIT_CATEGORY.Security;
    default:
      return AUDIT_CATEGORY.Administrative;
  }
}
