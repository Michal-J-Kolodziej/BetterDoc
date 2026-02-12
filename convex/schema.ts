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
  tipComponentLinks: defineTable({
    tipId: v.id('tips'),
    workspaceId: v.string(),
    projectName: v.string(),
    componentName: v.string(),
    componentFilePath: v.string(),
    organizationId: v.optional(v.string()),
    linkedByWorkosUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_tip_id', ['tipId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_project', ['workspaceId', 'projectName'])
    .index('by_workspace_component_file', [
      'workspaceId',
      'projectName',
      'componentName',
      'componentFilePath',
    ]),
  scanRuns: defineTable({
    idempotencyKey: v.string(),
    payloadHash: v.string(),
    workspaceId: v.string(),
    scannerName: v.string(),
    scannerVersion: v.optional(v.string()),
    source: v.union(
      v.literal('manual'),
      v.literal('pipeline'),
      v.literal('scheduled'),
    ),
    status: v.union(
      v.literal('processing'),
      v.literal('succeeded'),
      v.literal('failed'),
    ),
    attemptCount: v.number(),
    graphVersionId: v.optional(v.id('componentGraphVersions')),
    graphVersionNumber: v.optional(v.number()),
    projectCount: v.number(),
    libraryCount: v.number(),
    componentCount: v.number(),
    dependencyCount: v.number(),
    metadata: v.optional(
      v.object({
        branch: v.optional(v.string()),
        commitSha: v.optional(v.string()),
        runId: v.optional(v.string()),
      }),
    ),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),
  })
    .index('by_idempotency_key', ['idempotencyKey'])
    .index('by_workspace_status_started_at', ['workspaceId', 'status', 'startedAt'])
    .index('by_status_completed_at', ['status', 'completedAt']),
  componentGraphHeads: defineTable({
    workspaceId: v.string(),
    latestVersion: v.number(),
    updatedAt: v.number(),
  }).index('by_workspace_id', ['workspaceId']),
  componentGraphVersions: defineTable({
    workspaceId: v.string(),
    version: v.number(),
    scanRunId: v.id('scanRuns'),
    payloadHash: v.string(),
    schemaVersion: v.number(),
    workspaceConfigPath: v.string(),
    projectCount: v.number(),
    libraryCount: v.number(),
    componentCount: v.number(),
    dependencyCount: v.number(),
    createdAt: v.number(),
  })
    .index('by_workspace_version', ['workspaceId', 'version'])
    .index('by_scan_run_id', ['scanRunId'])
    .index('by_workspace_created_at', ['workspaceId', 'createdAt']),
  componentGraphProjects: defineTable({
    versionId: v.id('componentGraphVersions'),
    name: v.string(),
    type: v.union(v.literal('application'), v.literal('library')),
    rootPath: v.string(),
    sourceRootPath: v.union(v.string(), v.null()),
    configFilePath: v.string(),
    dependencies: v.array(v.string()),
  })
    .index('by_version_id', ['versionId'])
    .index('by_version_name', ['versionId', 'name']),
  componentGraphComponents: defineTable({
    versionId: v.id('componentGraphVersions'),
    name: v.string(),
    className: v.union(v.string(), v.null()),
    selector: v.union(v.string(), v.null()),
    standalone: v.union(v.boolean(), v.null()),
    project: v.string(),
    filePath: v.string(),
    dependencies: v.array(v.string()),
  })
    .index('by_version_id', ['versionId'])
    .index('by_version_project', ['versionId', 'project']),
  componentGraphDependencies: defineTable({
    versionId: v.id('componentGraphVersions'),
    sourceProject: v.string(),
    targetProject: v.string(),
    viaFiles: v.array(v.string()),
  })
    .index('by_version_id', ['versionId'])
    .index('by_version_edge', ['versionId', 'sourceProject', 'targetProject']),
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
