import { describe, expect, it } from 'vitest'

import {
  hasPermission,
  normalizeRole,
  privilegedActions,
  roleToPermissions,
} from './rbac'

describe('RBAC matrix', () => {
  it('grants expected Reader permissions', () => {
    expect(roleToPermissions.Reader).toEqual(['tips.read'])
  })

  it('grants expected Contributor permissions', () => {
    expect(roleToPermissions.Contributor).toEqual(['tips.read', 'tips.create'])
  })

  it('grants expected Reviewer permissions', () => {
    expect(roleToPermissions.Reviewer).toEqual([
      'tips.read',
      'tips.create',
      'tips.publish',
      'tips.deprecate',
      'audit.read',
    ])
  })

  it('grants expected Admin permissions', () => {
    expect(roleToPermissions.Admin).toEqual([
      'tips.read',
      'tips.create',
      'tips.publish',
      'tips.deprecate',
      'roles.assign',
      'integration.configure',
      'audit.read',
    ])
  })

  it('enforces can/cannot checks', () => {
    expect(hasPermission('Reader', 'tips.read')).toBe(true)
    expect(hasPermission('Reader', 'tips.create')).toBe(false)
    expect(hasPermission('Reviewer', 'tips.publish')).toBe(true)
    expect(hasPermission('Reviewer', 'roles.assign')).toBe(false)
    expect(hasPermission('Admin', 'roles.assign')).toBe(true)
  })
})

describe('privileged actions', () => {
  it('covers BD-005 audit-required actions', () => {
    expect(privilegedActions).toEqual([
      'tip.publish',
      'tip.deprecate',
      'role.assign',
      'integration.configure',
    ])
  })
})

describe('normalizeRole', () => {
  it('falls back to Reader when missing or unknown', () => {
    expect(normalizeRole(undefined)).toBe('Reader')
    expect(normalizeRole(null)).toBe('Reader')
    expect(normalizeRole('UnknownRole')).toBe('Reader')
  })

  it('accepts known roles', () => {
    expect(normalizeRole('Reader')).toBe('Reader')
    expect(normalizeRole('Contributor')).toBe('Contributor')
    expect(normalizeRole('Reviewer')).toBe('Reviewer')
    expect(normalizeRole('Admin')).toBe('Admin')
  })
})
