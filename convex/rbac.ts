import { v } from 'convex/values'

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

export const appRoleValidator = v.union(
  v.literal('Reader'),
  v.literal('Contributor'),
  v.literal('Reviewer'),
  v.literal('Admin'),
)

export const permissionValidator = v.union(
  v.literal('tips.read'),
  v.literal('tips.create'),
  v.literal('tips.publish'),
  v.literal('tips.deprecate'),
  v.literal('roles.assign'),
  v.literal('integration.configure'),
  v.literal('audit.read'),
)

export const privilegedActionValidator = v.union(
  v.literal('tip.publish'),
  v.literal('tip.deprecate'),
  v.literal('role.assign'),
  v.literal('integration.configure'),
)

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
