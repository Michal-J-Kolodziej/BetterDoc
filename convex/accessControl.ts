import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import {
  appRoleValidator,
  hasPermission,
  permissionValidator,
  privilegedActionValidator,
  roleToPermissions,
  type AppRole,
  type Permission,
  type PrivilegedAction,
} from './rbac'

const actorContextShape = {
  actorWorkosUserId: v.string(),
  actorOrganizationId: v.optional(v.string()),
}

const auditTargetTypeValidator = v.union(
  v.literal('tip'),
  v.literal('membership'),
  v.literal('integration'),
)

type DatabaseReaderLike = QueryCtx['db'] | MutationCtx['db']

async function getMembershipByWorkosUserId(
  db: DatabaseReaderLike,
  workosUserId: string,
): Promise<Doc<'memberships'> | null> {
  return db
    .query('memberships')
    .withIndex('by_workos_user_id', (queryBuilder) =>
      queryBuilder.eq('workosUserId', workosUserId),
    )
    .unique()
}

async function getRoleForActor(
  db: DatabaseReaderLike,
  workosUserId: string,
): Promise<AppRole> {
  const membership = await getMembershipByWorkosUserId(db, workosUserId)

  return membership?.role ?? 'Reader'
}

async function requirePermission(
  db: DatabaseReaderLike,
  workosUserId: string,
  permission: Permission,
): Promise<AppRole> {
  const actorRole = await getRoleForActor(db, workosUserId)

  if (!hasPermission(actorRole, permission)) {
    throw new ConvexError(
      `Permission denied: ${actorRole} cannot perform "${permission}"`,
    )
  }

  return actorRole
}

async function insertAuditEvent(
  ctx: MutationCtx,
  args: {
    actorWorkosUserId: string
    actorOrganizationId?: string
    actorRole: AppRole
    action: PrivilegedAction
    targetType: 'tip' | 'membership' | 'integration'
    targetId: string
    summary: string
  },
): Promise<Id<'auditEvents'>> {
  // Audit events are append-only: this module only inserts records.
  return ctx.db.insert('auditEvents', {
    actorWorkosUserId: args.actorWorkosUserId,
    actorRole: args.actorRole,
    organizationId: args.actorOrganizationId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    summary: args.summary,
    createdAt: Date.now(),
  })
}

export const getAccessProfile = query({
  args: {
    workosUserId: v.string(),
    organizationId: v.optional(v.string()),
  },
  returns: v.object({
    role: appRoleValidator,
    permissions: v.array(permissionValidator),
    organizationId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const role = await getRoleForActor(ctx.db, args.workosUserId)

    return {
      role,
      permissions: [...roleToPermissions[role]],
      organizationId: args.organizationId ?? null,
    }
  },
})

export const bootstrapFirstAdmin = mutation({
  args: {
    actorWorkosUserId: v.string(),
    actorOrganizationId: v.optional(v.string()),
  },
  returns: v.object({
    membershipId: v.id('memberships'),
    role: appRoleValidator,
  }),
  handler: async (ctx, args) => {
    const existingMemberships = await ctx.db.query('memberships').take(1)

    if (existingMemberships.length > 0) {
      throw new ConvexError(
        'Bootstrap admin is unavailable because memberships already exist.',
      )
    }

    const membershipId = await ctx.db.insert('memberships', {
      workosUserId: args.actorWorkosUserId,
      organizationId: args.actorOrganizationId,
      role: 'Admin',
      assignedByWorkosUserId: args.actorWorkosUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await insertAuditEvent(ctx, {
      actorWorkosUserId: args.actorWorkosUserId,
      actorOrganizationId: args.actorOrganizationId,
      actorRole: 'Admin',
      action: 'role.assign',
      targetType: 'membership',
      targetId: membershipId,
      summary: `Bootstrapped first admin membership for ${args.actorWorkosUserId}`,
    })

    return {
      membershipId,
      role: 'Admin' as const,
    }
  },
})

export const listTips = query({
  args: {
    actorWorkosUserId: v.string(),
    actorOrganizationId: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      id: v.id('tips'),
      slug: v.string(),
      title: v.string(),
      status: v.union(v.literal('draft'), v.literal('published'), v.literal('deprecated')),
      organizationId: v.union(v.string(), v.null()),
      updatedByWorkosUserId: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const actorRole = await requirePermission(
      ctx.db,
      args.actorWorkosUserId,
      'tips.read',
    )

    const tips = await ctx.db.query('tips').order('desc').take(100)

    return tips
      .filter((tip) => {
        const sameOrg = args.actorOrganizationId
          ? tip.organizationId === args.actorOrganizationId
          : true
        const canSeeStatus =
          actorRole === 'Reader' ? tip.status === 'published' : true

        return sameOrg && canSeeStatus
      })
      .map((tip) => ({
        id: tip._id,
        slug: tip.slug,
        title: tip.title,
        status: tip.status,
        organizationId: tip.organizationId ?? null,
        updatedByWorkosUserId: tip.updatedByWorkosUserId,
        updatedAt: tip.updatedAt,
      }))
  },
})

export const assignRole = mutation({
  args: {
    ...actorContextShape,
    targetWorkosUserId: v.string(),
    targetOrganizationId: v.optional(v.string()),
    role: appRoleValidator,
  },
  returns: v.object({
    membershipId: v.id('memberships'),
    role: appRoleValidator,
  }),
  handler: async (ctx, args) => {
    const actorRole = await requirePermission(
      ctx.db,
      args.actorWorkosUserId,
      'roles.assign',
    )

    const membership = await getMembershipByWorkosUserId(
      ctx.db,
      args.targetWorkosUserId,
    )

    const organizationId = args.targetOrganizationId ?? args.actorOrganizationId
    const now = Date.now()
    let membershipId: Id<'memberships'>

    if (membership) {
      membershipId = membership._id
      await ctx.db.patch(membership._id, {
        organizationId,
        role: args.role,
        assignedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })
    } else {
      membershipId = await ctx.db.insert('memberships', {
        workosUserId: args.targetWorkosUserId,
        organizationId,
        role: args.role,
        assignedByWorkosUserId: args.actorWorkosUserId,
        createdAt: now,
        updatedAt: now,
      })
    }

    await insertAuditEvent(ctx, {
      actorWorkosUserId: args.actorWorkosUserId,
      actorOrganizationId: args.actorOrganizationId,
      actorRole,
      action: 'role.assign',
      targetType: 'membership',
      targetId: membershipId,
      summary: `Assigned ${args.role} to ${args.targetWorkosUserId}`,
    })

    return {
      membershipId,
      role: args.role,
    }
  },
})

export const createTipDraft = mutation({
  args: {
    ...actorContextShape,
    slug: v.string(),
    title: v.string(),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('deprecated')),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const existingTip = await ctx.db
      .query('tips')
      .withIndex('by_slug', (queryBuilder) => queryBuilder.eq('slug', args.slug))
      .unique()

    const now = Date.now()

    if (existingTip) {
      await ctx.db.patch(existingTip._id, {
        title: args.title,
        status: 'draft',
        organizationId: args.actorOrganizationId,
        updatedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })

      return {
        tipId: existingTip._id,
        status: 'draft' as const,
      }
    }

    const tipId = await ctx.db.insert('tips', {
      slug: args.slug,
      title: args.title,
      status: 'draft',
      organizationId: args.actorOrganizationId,
      updatedByWorkosUserId: args.actorWorkosUserId,
      updatedAt: now,
    })

    return {
      tipId,
      status: 'draft' as const,
    }
  },
})

export const publishTip = mutation({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.literal('published'),
    auditEventId: v.id('auditEvents'),
  }),
  handler: async (ctx, args) => {
    const actorRole = await requirePermission(
      ctx.db,
      args.actorWorkosUserId,
      'tips.publish',
    )

    const tip = await ctx.db.get(args.tipId)

    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    await ctx.db.patch(tip._id, {
      status: 'published',
      updatedByWorkosUserId: args.actorWorkosUserId,
      updatedAt: Date.now(),
    })

    const auditEventId = await insertAuditEvent(ctx, {
      actorWorkosUserId: args.actorWorkosUserId,
      actorOrganizationId: args.actorOrganizationId,
      actorRole,
      action: 'tip.publish',
      targetType: 'tip',
      targetId: tip._id,
      summary: `Published tip "${tip.title}"`,
    })

    return {
      tipId: tip._id,
      status: 'published' as const,
      auditEventId,
    }
  },
})

export const deprecateTip = mutation({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.literal('deprecated'),
    auditEventId: v.id('auditEvents'),
  }),
  handler: async (ctx, args) => {
    const actorRole = await requirePermission(
      ctx.db,
      args.actorWorkosUserId,
      'tips.deprecate',
    )

    const tip = await ctx.db.get(args.tipId)

    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    await ctx.db.patch(tip._id, {
      status: 'deprecated',
      updatedByWorkosUserId: args.actorWorkosUserId,
      updatedAt: Date.now(),
    })

    const auditEventId = await insertAuditEvent(ctx, {
      actorWorkosUserId: args.actorWorkosUserId,
      actorOrganizationId: args.actorOrganizationId,
      actorRole,
      action: 'tip.deprecate',
      targetType: 'tip',
      targetId: tip._id,
      summary: `Deprecated tip "${tip.title}"`,
    })

    return {
      tipId: tip._id,
      status: 'deprecated' as const,
      auditEventId,
    }
  },
})

export const configureIntegration = mutation({
  args: {
    ...actorContextShape,
    key: v.string(),
    enabled: v.boolean(),
  },
  returns: v.object({
    integrationId: v.id('integrationConfigs'),
    configVersion: v.number(),
    auditEventId: v.id('auditEvents'),
  }),
  handler: async (ctx, args) => {
    const actorRole = await requirePermission(
      ctx.db,
      args.actorWorkosUserId,
      'integration.configure',
    )

    const existingConfig = await ctx.db
      .query('integrationConfigs')
      .withIndex('by_key', (queryBuilder) => queryBuilder.eq('key', args.key))
      .unique()

    const now = Date.now()
    const configVersion = existingConfig ? existingConfig.configVersion + 1 : 1

    let integrationId: Id<'integrationConfigs'>

    if (existingConfig) {
      integrationId = existingConfig._id
      await ctx.db.patch(existingConfig._id, {
        enabled: args.enabled,
        organizationId: args.actorOrganizationId,
        configVersion,
        updatedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })
    } else {
      integrationId = await ctx.db.insert('integrationConfigs', {
        key: args.key,
        enabled: args.enabled,
        organizationId: args.actorOrganizationId,
        configVersion,
        updatedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })
    }

    const auditEventId = await insertAuditEvent(ctx, {
      actorWorkosUserId: args.actorWorkosUserId,
      actorOrganizationId: args.actorOrganizationId,
      actorRole,
      action: 'integration.configure',
      targetType: 'integration',
      targetId: integrationId,
      summary: `Set integration "${args.key}" enabled=${String(args.enabled)}`,
    })

    return {
      integrationId,
      configVersion,
      auditEventId,
    }
  },
})

export const listAuditEvents = query({
  args: {
    actorWorkosUserId: v.string(),
    actorOrganizationId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      actorWorkosUserId: v.string(),
      actorRole: appRoleValidator,
      organizationId: v.union(v.string(), v.null()),
      action: privilegedActionValidator,
      targetType: auditTargetTypeValidator,
      targetId: v.string(),
      summary: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'audit.read')

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
    const events = await ctx.db.query('auditEvents').order('desc').take(limit)

    return events
      .filter((event) => {
        if (!args.actorOrganizationId) {
          return true
        }

        return event.organizationId === args.actorOrganizationId
      })
      .map((event) => ({
        id: event._id,
        actorWorkosUserId: event.actorWorkosUserId,
        actorRole: event.actorRole,
        organizationId: event.organizationId ?? null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        summary: event.summary,
        createdAt: event.createdAt,
      }))
  },
})
