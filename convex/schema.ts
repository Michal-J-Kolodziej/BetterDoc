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
    project: v.optional(v.string()),
    library: v.optional(v.string()),
    component: v.optional(v.string()),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    searchText: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('in_review'),
      v.literal('published'),
      v.literal('deprecated'),
    ),
    organizationId: v.optional(v.string()),
    createdByWorkosUserId: v.string(),
    createdAt: v.number(),
    currentRevision: v.number(),
    updatedByWorkosUserId: v.string(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_updated_at', ['updatedAt'])
    .index('by_org_updated_at', ['organizationId', 'updatedAt'])
    .index('by_org_status_updated_at', ['organizationId', 'status', 'updatedAt'])
    .index('by_org_project_updated_at', ['organizationId', 'project', 'updatedAt'])
    .index('by_org_library_updated_at', ['organizationId', 'library', 'updatedAt'])
    .index('by_org_component_updated_at', ['organizationId', 'component', 'updatedAt'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['organizationId', 'status', 'project', 'library', 'component'],
    }),
  tipRevisions: defineTable({
    tipId: v.id('tips'),
    revisionNumber: v.number(),
    title: v.string(),
    slug: v.string(),
    symptom: v.string(),
    rootCause: v.string(),
    fix: v.string(),
    prevention: v.string(),
    project: v.optional(v.string()),
    library: v.optional(v.string()),
    component: v.optional(v.string()),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    searchText: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('in_review'),
      v.literal('published'),
      v.literal('deprecated'),
    ),
    organizationId: v.optional(v.string()),
    editedByWorkosUserId: v.string(),
    createdAt: v.number(),
  })
    .index('by_tip_id', ['tipId'])
    .index('by_tip_id_revision_number', ['tipId', 'revisionNumber']),
  tipTagFacets: defineTable({
    tipId: v.id('tips'),
    tag: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('in_review'),
      v.literal('published'),
      v.literal('deprecated'),
    ),
    organizationId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_tip_id', ['tipId'])
    .index('by_tag_updated_at', ['tag', 'updatedAt'])
    .index('by_tag_status_updated_at', ['tag', 'status', 'updatedAt'])
    .index('by_org_tag_updated_at', ['organizationId', 'tag', 'updatedAt'])
    .index('by_org_tag_status_updated_at', [
      'organizationId',
      'tag',
      'status',
      'updatedAt',
    ]),
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
