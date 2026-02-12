export const appRoles = ['Reader', 'Contributor', 'Reviewer', 'Admin'] as const

export type AppRole = (typeof appRoles)[number]

export const permissions = [
  'tips.read',
  'tips.create',
  'tips.publish',
  'tips.deprecate',
  'roles.assign',
  'integration.configure',
  'audit.read',
] as const

export type Permission = (typeof permissions)[number]

export const privilegedActions = [
  'tip.publish',
  'tip.deprecate',
  'role.assign',
  'integration.configure',
] as const

export type PrivilegedAction = (typeof privilegedActions)[number]

/**
 * RBAC matrix (BD-004):
 * - Reader: tips.read
 * - Contributor: tips.read, tips.create
 * - Reviewer: tips.read, tips.create, tips.publish, tips.deprecate, audit.read
 * - Admin: all Reviewer capabilities + roles.assign + integration.configure
 */
export const roleToPermissions: Record<AppRole, readonly Permission[]> = {
  Reader: ['tips.read'],
  Contributor: ['tips.read', 'tips.create'],
  Reviewer: [
    'tips.read',
    'tips.create',
    'tips.publish',
    'tips.deprecate',
    'audit.read',
  ],
  Admin: [
    'tips.read',
    'tips.create',
    'tips.publish',
    'tips.deprecate',
    'roles.assign',
    'integration.configure',
    'audit.read',
  ],
}

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return roleToPermissions[role].includes(permission)
}

export function normalizeRole(value: string | null | undefined): AppRole {
  if (!value) {
    return 'Reader'
  }

  return appRoles.includes(value as AppRole) ? (value as AppRole) : 'Reader'
}
