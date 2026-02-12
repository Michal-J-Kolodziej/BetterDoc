import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  appRoleValidator,
  privilegedActionValidator,
} from './rbac'

export default defineSchema({
  memberships: defineTable({
    workosUserId: v.string(),
    organizationId: v.optional(v.string()),
    role: appRoleValidator,
    assignedByWorkosUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workos_user_id', ['workosUserId']),
  tips: defineTable({
    slug: v.string(),
    title: v.string(),
    symptom: v.string(),
    rootCause: v.string(),
    fix: v.string(),
    prevention: v.string(),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('deprecated')),
    organizationId: v.optional(v.string()),
    createdByWorkosUserId: v.string(),
    createdAt: v.number(),
    currentRevision: v.number(),
    updatedByWorkosUserId: v.string(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_updated_at', ['updatedAt']),
  tipRevisions: defineTable({
    tipId: v.id('tips'),
    revisionNumber: v.number(),
    title: v.string(),
    slug: v.string(),
    symptom: v.string(),
    rootCause: v.string(),
    fix: v.string(),
    prevention: v.string(),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('deprecated')),
    organizationId: v.optional(v.string()),
    editedByWorkosUserId: v.string(),
    createdAt: v.number(),
  })
    .index('by_tip_id', ['tipId'])
    .index('by_tip_id_revision_number', ['tipId', 'revisionNumber']),
  integrationConfigs: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    organizationId: v.optional(v.string()),
    configVersion: v.number(),
    updatedByWorkosUserId: v.string(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),
  auditEvents: defineTable({
    actorWorkosUserId: v.string(),
    actorRole: appRoleValidator,
    organizationId: v.optional(v.string()),
    action: privilegedActionValidator,
    targetType: v.union(
      v.literal('tip'),
      v.literal('membership'),
      v.literal('integration'),
    ),
    targetId: v.string(),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index('by_created_at', ['createdAt'])
    .index('by_actor', ['actorWorkosUserId'])
    .index('by_target', ['targetType', 'targetId']),
})
