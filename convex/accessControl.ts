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
import {
  buildTipMetadata,
  buildTipSearchText,
  normalizeTipDraftInput,
} from './tipDraft'

const actorContextShape = {
  actorWorkosUserId: v.string(),
  actorOrganizationId: v.optional(v.string()),
}

const auditTargetTypeValidator = v.union(
  v.literal('tip'),
  v.literal('membership'),
  v.literal('integration'),
)

const tipStatusValidator = v.union(
  v.literal('draft'),
  v.literal('in_review'),
  v.literal('published'),
  v.literal('deprecated'),
)

type TipStatus = 'draft' | 'in_review' | 'published' | 'deprecated'

const tipStatusTransitions: Record<TipStatus, readonly TipStatus[]> = {
  draft: ['in_review'],
  in_review: ['draft', 'published'],
  published: ['deprecated'],
  deprecated: [],
}

const componentGraphProjectTypeValidator = v.union(
  v.literal('application'),
  v.literal('library'),
)

const scanIngestionSourceValidator = v.union(
  v.literal('manual'),
  v.literal('pipeline'),
  v.literal('scheduled'),
)

const tipComponentLinkInputValidator = v.object({
  workspaceId: v.string(),
  projectName: v.string(),
  componentName: v.string(),
  componentFilePath: v.string(),
})

type TipComponentLinkInput = {
  workspaceId: string
  projectName: string
  componentName: string
  componentFilePath: string
}

const componentLinkFieldLimits = {
  workspaceId: 128,
  projectName: 128,
  componentName: 160,
  componentFilePath: 320,
} as const

const componentExplorerProjectValidator = v.object({
  name: v.string(),
  type: componentGraphProjectTypeValidator,
  rootPath: v.string(),
  sourceRootPath: v.union(v.string(), v.null()),
  configFilePath: v.string(),
  dependencies: v.array(v.string()),
  componentCount: v.number(),
})

const componentExplorerDependencyValidator = v.object({
  sourceProject: v.string(),
  targetProject: v.string(),
  viaFiles: v.array(v.string()),
})

const componentExplorerComponentValidator = v.object({
  id: v.id('componentGraphComponents'),
  name: v.string(),
  className: v.union(v.string(), v.null()),
  selector: v.union(v.string(), v.null()),
  standalone: v.union(v.boolean(), v.null()),
  project: v.string(),
  filePath: v.string(),
  dependencies: v.array(v.string()),
})

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

function assertTipOrganizationAccess(
  tip: Doc<'tips'>,
  actorOrganizationId: string | undefined,
): void {
  if (!actorOrganizationId) {
    return
  }

  if (tip.organizationId !== actorOrganizationId) {
    throw new ConvexError('Tip not found for this organization.')
  }
}

function normalizeOptionalFilter(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeRequiredText(
  value: string,
  field: string,
  maxLength: number,
): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new ConvexError(`${field} is required.`)
  }

  if (normalized.length > maxLength) {
    throw new ConvexError(
      `${field} must be ${String(maxLength)} characters or fewer.`,
    )
  }

  return normalized
}

function normalizeTagFacet(tag: string): string {
  return tag.trim().toLowerCase()
}

function normalizeTipComponentLinks(
  links: TipComponentLinkInput[],
): TipComponentLinkInput[] {
  const dedupedLinks = new Map<string, TipComponentLinkInput>()

  for (const link of links) {
    const workspaceId = normalizeRequiredText(
      link.workspaceId,
      'workspaceId',
      componentLinkFieldLimits.workspaceId,
    )
    const projectName = normalizeRequiredText(
      link.projectName,
      'projectName',
      componentLinkFieldLimits.projectName,
    )
    const componentName = normalizeRequiredText(
      link.componentName,
      'componentName',
      componentLinkFieldLimits.componentName,
    )
    const componentFilePath = normalizeRequiredText(
      link.componentFilePath,
      'componentFilePath',
      componentLinkFieldLimits.componentFilePath,
    )

    const dedupeKey = [
      workspaceId.toLowerCase(),
      projectName.toLowerCase(),
      componentName.toLowerCase(),
      componentFilePath.toLowerCase(),
    ].join('::')

    dedupedLinks.set(dedupeKey, {
      workspaceId,
      projectName,
      componentName,
      componentFilePath,
    })
  }

  if (dedupedLinks.size > 40) {
    throw new ConvexError('No more than 40 component links are allowed per tip.')
  }

  return [...dedupedLinks.values()]
}

function canReadTipStatus(actorRole: AppRole, status: TipStatus): boolean {
  if (actorRole === 'Reader') {
    return status === 'published'
  }

  return true
}

function assertStatusTransition(current: TipStatus, next: TipStatus): void {
  if (current === next) {
    return
  }

  if (!tipStatusTransitions[current].includes(next)) {
    throw new ConvexError(
      `Invalid status transition: ${current} -> ${next}. Allowed next states: ${tipStatusTransitions[current].join(', ') || 'none'}.`,
    )
  }
}

async function replaceTipTagFacets(
  ctx: MutationCtx,
  args: {
    tipId: Id<'tips'>
    organizationId?: string
    status: TipStatus
    tags: string[]
    updatedAt: number
  },
): Promise<void> {
  const existingFacets = await ctx.db
    .query('tipTagFacets')
    .withIndex('by_tip_id', (queryBuilder) => queryBuilder.eq('tipId', args.tipId))
    .collect()

  await Promise.all(existingFacets.map((facet) => ctx.db.delete(facet._id)))

  const uniqueTagFacets = [...new Set(args.tags.map(normalizeTagFacet))]

  await Promise.all(
    uniqueTagFacets
      .filter((tag) => tag.length > 0)
      .map((tag) =>
        ctx.db.insert('tipTagFacets', {
          tipId: args.tipId,
          tag,
          status: args.status,
          organizationId: args.organizationId,
          updatedAt: args.updatedAt,
        }),
      ),
  )
}

async function appendTipRevisionSnapshot(
  ctx: MutationCtx,
  args: {
    tip: Doc<'tips'>
    revisionNumber: number
    status: TipStatus
    editedByWorkosUserId: string
    createdAt: number
  },
): Promise<void> {
  await ctx.db.insert('tipRevisions', {
    tipId: args.tip._id,
    revisionNumber: args.revisionNumber,
    title: args.tip.title,
    slug: args.tip.slug,
    symptom: args.tip.symptom,
    rootCause: args.tip.rootCause,
    fix: args.tip.fix,
    prevention: args.tip.prevention,
    project: args.tip.project,
    library: args.tip.library,
    component: args.tip.component,
    tags: args.tip.tags,
    references: args.tip.references,
    searchText: args.tip.searchText,
    status: args.status,
    organizationId: args.tip.organizationId,
    editedByWorkosUserId: args.editedByWorkosUserId,
    createdAt: args.createdAt,
  })
}

async function patchTipStatusWithRevision(
  ctx: MutationCtx,
  args: {
    tip: Doc<'tips'>
    nextStatus: TipStatus
    actorWorkosUserId: string
    now: number
  },
): Promise<number> {
  assertStatusTransition(args.tip.status as TipStatus, args.nextStatus)

  const revisionNumber = args.tip.currentRevision + 1

  await ctx.db.patch(args.tip._id, {
    status: args.nextStatus,
    currentRevision: revisionNumber,
    updatedByWorkosUserId: args.actorWorkosUserId,
    updatedAt: args.now,
  })

  await appendTipRevisionSnapshot(ctx, {
    tip: {
      ...args.tip,
      status: args.nextStatus,
      currentRevision: revisionNumber,
      updatedByWorkosUserId: args.actorWorkosUserId,
      updatedAt: args.now,
    },
    revisionNumber,
    status: args.nextStatus,
    editedByWorkosUserId: args.actorWorkosUserId,
    createdAt: args.now,
  })

  await replaceTipTagFacets(ctx, {
    tipId: args.tip._id,
    organizationId: args.tip.organizationId,
    status: args.nextStatus,
    tags: args.tip.tags,
    updatedAt: args.now,
  })

  return revisionNumber
}

async function replaceTipComponentLinks(
  ctx: MutationCtx,
  args: {
    tipId: Id<'tips'>
    organizationId: string | undefined
    actorWorkosUserId: string
    links: TipComponentLinkInput[]
    now: number
  },
): Promise<void> {
  const existingLinks = await ctx.db
    .query('tipComponentLinks')
    .withIndex('by_tip_id', (queryBuilder) => queryBuilder.eq('tipId', args.tipId))
    .collect()

  await Promise.all(existingLinks.map((link) => ctx.db.delete(link._id)))

  await Promise.all(
    args.links.map((link) =>
      ctx.db.insert('tipComponentLinks', {
        tipId: args.tipId,
        workspaceId: link.workspaceId,
        projectName: link.projectName,
        componentName: link.componentName,
        componentFilePath: link.componentFilePath,
        organizationId: args.organizationId,
        linkedByWorkosUserId: args.actorWorkosUserId,
        createdAt: args.now,
        updatedAt: args.now,
      }),
    ),
  )
}

async function getLatestSuccessfulWorkspaceGraph(
  db: DatabaseReaderLike,
  workspaceId: string,
): Promise<{
  scanRun: Doc<'scanRuns'>
  graphVersionId: Id<'componentGraphVersions'>
  graphVersionNumber: number
} | null> {
  const latestRuns = await db
    .query('scanRuns')
    .withIndex('by_workspace_status_started_at', (queryBuilder) =>
      queryBuilder.eq('workspaceId', workspaceId).eq('status', 'succeeded'),
    )
    .order('desc')
    .take(1)

  const latestRun = latestRuns[0]
  if (!latestRun) {
    return null
  }

  if (
    !latestRun.graphVersionId ||
    typeof latestRun.graphVersionNumber !== 'number'
  ) {
    throw new ConvexError(
      'scanRuns record is inconsistent: succeeded run has no graph version linkage.',
    )
  }

  return {
    scanRun: latestRun,
    graphVersionId: latestRun.graphVersionId,
    graphVersionNumber: latestRun.graphVersionNumber,
  }
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
    searchText: v.optional(v.string()),
    project: v.optional(v.string()),
    library: v.optional(v.string()),
    component: v.optional(v.string()),
    tag: v.optional(v.string()),
    status: v.optional(tipStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id('tips'),
      slug: v.string(),
      title: v.string(),
      status: tipStatusValidator,
      project: v.union(v.string(), v.null()),
      library: v.union(v.string(), v.null()),
      component: v.union(v.string(), v.null()),
      tags: v.array(v.string()),
      currentRevision: v.number(),
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

    const searchText = normalizeOptionalFilter(args.searchText)
    const projectFilter = normalizeOptionalFilter(args.project)
    const libraryFilter = normalizeOptionalFilter(args.library)
    const componentFilter = normalizeOptionalFilter(args.component)
    const tagFilter = normalizeOptionalFilter(args.tag)
    const normalizedTagFilter = tagFilter ? normalizeTagFacet(tagFilter) : undefined
    const normalizedProjectFilter = projectFilter?.toLowerCase()
    const normalizedLibraryFilter = libraryFilter?.toLowerCase()
    const normalizedComponentFilter = componentFilter?.toLowerCase()
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 80)
    const fetchLimit = Math.min(limit * 4, 240)

    if (
      actorRole === 'Reader' &&
      args.status &&
      args.status !== 'published'
    ) {
      return []
    }

    const effectiveStatus: TipStatus | undefined =
      actorRole === 'Reader' ? 'published' : args.status

    let candidateTips: Doc<'tips'>[] = []

    if (searchText) {
      candidateTips = await ctx.db
        .query('tips')
        .withSearchIndex('search_text', (queryBuilder) => {
          let searchQuery = queryBuilder.search('searchText', searchText)

          if (args.actorOrganizationId) {
            searchQuery = searchQuery.eq(
              'organizationId',
              args.actorOrganizationId,
            )
          }

          if (effectiveStatus) {
            searchQuery = searchQuery.eq('status', effectiveStatus)
          }

          if (projectFilter) {
            searchQuery = searchQuery.eq('project', projectFilter)
          }

          if (libraryFilter) {
            searchQuery = searchQuery.eq('library', libraryFilter)
          }

          if (componentFilter) {
            searchQuery = searchQuery.eq('component', componentFilter)
          }

          return searchQuery
        })
        .take(fetchLimit)
    } else if (normalizedTagFilter) {
      const facets = args.actorOrganizationId
        ? effectiveStatus
          ? await ctx.db
              .query('tipTagFacets')
              .withIndex('by_org_tag_status_updated_at', (queryBuilder) =>
                queryBuilder
                  .eq('organizationId', args.actorOrganizationId)
                  .eq('tag', normalizedTagFilter)
                  .eq('status', effectiveStatus),
              )
              .order('desc')
              .take(fetchLimit)
          : await ctx.db
              .query('tipTagFacets')
              .withIndex('by_org_tag_updated_at', (queryBuilder) =>
                queryBuilder
                  .eq('organizationId', args.actorOrganizationId)
                  .eq('tag', normalizedTagFilter),
              )
              .order('desc')
              .take(fetchLimit)
        : effectiveStatus
          ? await ctx.db
              .query('tipTagFacets')
              .withIndex('by_tag_status_updated_at', (queryBuilder) =>
                queryBuilder
                  .eq('tag', normalizedTagFilter)
                  .eq('status', effectiveStatus),
              )
              .order('desc')
              .take(fetchLimit)
          : await ctx.db
              .query('tipTagFacets')
              .withIndex('by_tag_updated_at', (queryBuilder) =>
                queryBuilder.eq('tag', normalizedTagFilter),
              )
              .order('desc')
              .take(fetchLimit)

      const orderedTipIds = [...new Set(facets.map((facet) => facet.tipId))]
      const loadedTips = await Promise.all(
        orderedTipIds.map((tipId) => ctx.db.get(tipId)),
      )

      candidateTips = loadedTips.filter((tip): tip is Doc<'tips'> => tip !== null)
    } else if (args.actorOrganizationId) {
      if (effectiveStatus) {
        candidateTips = await ctx.db
          .query('tips')
          .withIndex('by_org_status_updated_at', (queryBuilder) =>
            queryBuilder
              .eq('organizationId', args.actorOrganizationId)
              .eq('status', effectiveStatus),
          )
          .order('desc')
          .take(fetchLimit)
      } else if (projectFilter) {
        candidateTips = await ctx.db
          .query('tips')
          .withIndex('by_org_project_updated_at', (queryBuilder) =>
            queryBuilder
              .eq('organizationId', args.actorOrganizationId)
              .eq('project', projectFilter),
          )
          .order('desc')
          .take(fetchLimit)
      } else if (libraryFilter) {
        candidateTips = await ctx.db
          .query('tips')
          .withIndex('by_org_library_updated_at', (queryBuilder) =>
            queryBuilder
              .eq('organizationId', args.actorOrganizationId)
              .eq('library', libraryFilter),
          )
          .order('desc')
          .take(fetchLimit)
      } else if (componentFilter) {
        candidateTips = await ctx.db
          .query('tips')
          .withIndex('by_org_component_updated_at', (queryBuilder) =>
            queryBuilder
              .eq('organizationId', args.actorOrganizationId)
              .eq('component', componentFilter),
          )
          .order('desc')
          .take(fetchLimit)
      } else {
        candidateTips = await ctx.db
          .query('tips')
          .withIndex('by_org_updated_at', (queryBuilder) =>
            queryBuilder.eq('organizationId', args.actorOrganizationId),
          )
          .order('desc')
          .take(fetchLimit)
      }
    } else {
      candidateTips = await ctx.db.query('tips').order('desc').take(fetchLimit)
    }

    const filteredTips = candidateTips
      .filter((tip) => {
        if (
          args.actorOrganizationId &&
          tip.organizationId !== args.actorOrganizationId
        ) {
          return false
        }

        const tipStatus = tip.status as TipStatus

        if (!canReadTipStatus(actorRole, tipStatus)) {
          return false
        }

        if (effectiveStatus && tipStatus !== effectiveStatus) {
          return false
        }

        if (
          normalizedProjectFilter &&
          (tip.project ?? '').toLowerCase() !== normalizedProjectFilter
        ) {
          return false
        }

        if (
          normalizedLibraryFilter &&
          (tip.library ?? '').toLowerCase() !== normalizedLibraryFilter
        ) {
          return false
        }

        if (
          normalizedComponentFilter &&
          (tip.component ?? '').toLowerCase() !== normalizedComponentFilter
        ) {
          return false
        }

        if (
          normalizedTagFilter &&
          !tip.tags.some((tag) => normalizeTagFacet(tag) === normalizedTagFilter)
        ) {
          return false
        }

        return true
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit)

    return filteredTips
      .map((tip) => ({
        id: tip._id,
        slug: tip.slug,
        title: tip.title,
        status: tip.status,
        project: tip.project ?? null,
        library: tip.library ?? null,
        component: tip.component ?? null,
        tags: tip.tags,
        currentRevision: tip.currentRevision,
        organizationId: tip.organizationId ?? null,
        updatedByWorkosUserId: tip.updatedByWorkosUserId,
        updatedAt: tip.updatedAt,
      }))
  },
})

export const listComponentExplorerWorkspaces = query({
  args: {
    ...actorContextShape,
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      workspaceId: v.string(),
      scanRunId: v.id('scanRuns'),
      graphVersionId: v.id('componentGraphVersions'),
      graphVersionNumber: v.number(),
      scannerName: v.string(),
      scannerVersion: v.union(v.string(), v.null()),
      source: scanIngestionSourceValidator,
      projectCount: v.number(),
      libraryCount: v.number(),
      componentCount: v.number(),
      dependencyCount: v.number(),
      completedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.read')

    const limit = Math.min(Math.max(args.limit ?? 12, 1), 30)
    const recentSucceededRuns = await ctx.db
      .query('scanRuns')
      .withIndex('by_status_completed_at', (queryBuilder) =>
        queryBuilder.eq('status', 'succeeded'),
      )
      .order('desc')
      .take(300)

    const latestRunByWorkspace = new Map<string, Doc<'scanRuns'>>()

    for (const run of recentSucceededRuns) {
      if (latestRunByWorkspace.has(run.workspaceId)) {
        continue
      }

      if (
        !run.graphVersionId ||
        typeof run.graphVersionNumber !== 'number'
      ) {
        continue
      }

      latestRunByWorkspace.set(run.workspaceId, run)

      if (latestRunByWorkspace.size >= limit) {
        break
      }
    }

    return [...latestRunByWorkspace.values()].map((run) => ({
      workspaceId: run.workspaceId,
      scanRunId: run._id,
      graphVersionId: run.graphVersionId as Id<'componentGraphVersions'>,
      graphVersionNumber: run.graphVersionNumber as number,
      scannerName: run.scannerName,
      scannerVersion: run.scannerVersion ?? null,
      source: run.source,
      projectCount: run.projectCount,
      libraryCount: run.libraryCount,
      componentCount: run.componentCount,
      dependencyCount: run.dependencyCount,
      completedAt: run.completedAt,
    }))
  },
})

export const getComponentExplorerWorkspace = query({
  args: {
    ...actorContextShape,
    workspaceId: v.string(),
  },
  returns: v.union(
    v.object({
      workspaceId: v.string(),
      scanRunId: v.id('scanRuns'),
      graphVersionId: v.id('componentGraphVersions'),
      graphVersionNumber: v.number(),
      scannerName: v.string(),
      scannerVersion: v.union(v.string(), v.null()),
      source: scanIngestionSourceValidator,
      projectCount: v.number(),
      libraryCount: v.number(),
      componentCount: v.number(),
      dependencyCount: v.number(),
      completedAt: v.number(),
      projects: v.array(componentExplorerProjectValidator),
      libraries: v.array(componentExplorerProjectValidator),
      dependencies: v.array(componentExplorerDependencyValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.read')

    const workspaceId = normalizeRequiredText(
      args.workspaceId,
      'workspaceId',
      componentLinkFieldLimits.workspaceId,
    )
    const latestGraph = await getLatestSuccessfulWorkspaceGraph(
      ctx.db,
      workspaceId,
    )

    if (!latestGraph) {
      return null
    }

    const [projects, components, dependencies] = await Promise.all([
      ctx.db
        .query('componentGraphProjects')
        .withIndex('by_version_id', (queryBuilder) =>
          queryBuilder.eq('versionId', latestGraph.graphVersionId),
        )
        .collect(),
      ctx.db
        .query('componentGraphComponents')
        .withIndex('by_version_id', (queryBuilder) =>
          queryBuilder.eq('versionId', latestGraph.graphVersionId),
        )
        .collect(),
      ctx.db
        .query('componentGraphDependencies')
        .withIndex('by_version_id', (queryBuilder) =>
          queryBuilder.eq('versionId', latestGraph.graphVersionId),
        )
        .collect(),
    ])

    const componentCountByProject = components.reduce<Map<string, number>>(
      (counts, component) => {
        const current = counts.get(component.project) ?? 0
        counts.set(component.project, current + 1)
        return counts
      },
      new Map<string, number>(),
    )

    const normalizedProjects = projects
      .map((project) => ({
        name: project.name,
        type: project.type,
        rootPath: project.rootPath,
        sourceRootPath: project.sourceRootPath,
        configFilePath: project.configFilePath,
        dependencies: [...project.dependencies].sort((left, right) =>
          left.localeCompare(right),
        ),
        componentCount: componentCountByProject.get(project.name) ?? 0,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))

    return {
      workspaceId: latestGraph.scanRun.workspaceId,
      scanRunId: latestGraph.scanRun._id,
      graphVersionId: latestGraph.graphVersionId,
      graphVersionNumber: latestGraph.graphVersionNumber,
      scannerName: latestGraph.scanRun.scannerName,
      scannerVersion: latestGraph.scanRun.scannerVersion ?? null,
      source: latestGraph.scanRun.source,
      projectCount: latestGraph.scanRun.projectCount,
      libraryCount: latestGraph.scanRun.libraryCount,
      componentCount: latestGraph.scanRun.componentCount,
      dependencyCount: latestGraph.scanRun.dependencyCount,
      completedAt: latestGraph.scanRun.completedAt,
      projects: normalizedProjects,
      libraries: normalizedProjects.filter((project) => project.type === 'library'),
      dependencies: dependencies
        .map((dependency) => ({
          sourceProject: dependency.sourceProject,
          targetProject: dependency.targetProject,
          viaFiles: [...dependency.viaFiles].sort((left, right) =>
            left.localeCompare(right),
          ),
        }))
        .sort((left, right) => {
          const sourceOrder = left.sourceProject.localeCompare(right.sourceProject)
          if (sourceOrder !== 0) {
            return sourceOrder
          }

          return left.targetProject.localeCompare(right.targetProject)
        }),
    }
  },
})

export const getComponentExplorerProject = query({
  args: {
    ...actorContextShape,
    workspaceId: v.string(),
    projectName: v.string(),
  },
  returns: v.union(
    v.object({
      workspaceId: v.string(),
      graphVersionId: v.id('componentGraphVersions'),
      graphVersionNumber: v.number(),
      project: componentExplorerProjectValidator,
      components: v.array(componentExplorerComponentValidator),
      dependenciesOut: v.array(componentExplorerDependencyValidator),
      dependenciesIn: v.array(componentExplorerDependencyValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.read')

    const workspaceId = normalizeRequiredText(
      args.workspaceId,
      'workspaceId',
      componentLinkFieldLimits.workspaceId,
    )
    const projectName = normalizeRequiredText(
      args.projectName,
      'projectName',
      componentLinkFieldLimits.projectName,
    )
    const latestGraph = await getLatestSuccessfulWorkspaceGraph(
      ctx.db,
      workspaceId,
    )

    if (!latestGraph) {
      return null
    }

    const [project, components, dependencies] = await Promise.all([
      ctx.db
        .query('componentGraphProjects')
        .withIndex('by_version_name', (queryBuilder) =>
          queryBuilder
            .eq('versionId', latestGraph.graphVersionId)
            .eq('name', projectName),
        )
        .unique(),
      ctx.db
        .query('componentGraphComponents')
        .withIndex('by_version_project', (queryBuilder) =>
          queryBuilder
            .eq('versionId', latestGraph.graphVersionId)
            .eq('project', projectName),
        )
        .collect(),
      ctx.db
        .query('componentGraphDependencies')
        .withIndex('by_version_id', (queryBuilder) =>
          queryBuilder.eq('versionId', latestGraph.graphVersionId),
        )
        .collect(),
    ])

    if (!project) {
      return null
    }

    return {
      workspaceId,
      graphVersionId: latestGraph.graphVersionId,
      graphVersionNumber: latestGraph.graphVersionNumber,
      project: {
        name: project.name,
        type: project.type,
        rootPath: project.rootPath,
        sourceRootPath: project.sourceRootPath,
        configFilePath: project.configFilePath,
        dependencies: [...project.dependencies].sort((left, right) =>
          left.localeCompare(right),
        ),
        componentCount: components.length,
      },
      components: components
        .map((component) => ({
          id: component._id,
          name: component.name,
          className: component.className,
          selector: component.selector,
          standalone: component.standalone,
          project: component.project,
          filePath: component.filePath,
          dependencies: [...component.dependencies].sort((left, right) =>
            left.localeCompare(right),
          ),
        }))
        .sort((left, right) => {
          const nameOrder = left.name.localeCompare(right.name)
          if (nameOrder !== 0) {
            return nameOrder
          }

          return left.filePath.localeCompare(right.filePath)
        }),
      dependenciesOut: dependencies
        .filter((dependency) => dependency.sourceProject === projectName)
        .map((dependency) => ({
          sourceProject: dependency.sourceProject,
          targetProject: dependency.targetProject,
          viaFiles: [...dependency.viaFiles].sort((left, right) =>
            left.localeCompare(right),
          ),
        })),
      dependenciesIn: dependencies
        .filter((dependency) => dependency.targetProject === projectName)
        .map((dependency) => ({
          sourceProject: dependency.sourceProject,
          targetProject: dependency.targetProject,
          viaFiles: [...dependency.viaFiles].sort((left, right) =>
            left.localeCompare(right),
          ),
        })),
    }
  },
})

export const getComponentExplorerComponent = query({
  args: {
    ...actorContextShape,
    workspaceId: v.string(),
    componentId: v.id('componentGraphComponents'),
  },
  returns: v.union(
    v.object({
      workspaceId: v.string(),
      graphVersionId: v.id('componentGraphVersions'),
      graphVersionNumber: v.number(),
      component: componentExplorerComponentValidator,
      project: v.object({
        name: v.string(),
        type: componentGraphProjectTypeValidator,
      }),
      dependenciesOut: v.array(componentExplorerDependencyValidator),
      dependenciesIn: v.array(componentExplorerDependencyValidator),
      relatedPublishedTips: v.array(
        v.object({
          id: v.id('tips'),
          slug: v.string(),
          title: v.string(),
          project: v.union(v.string(), v.null()),
          library: v.union(v.string(), v.null()),
          component: v.union(v.string(), v.null()),
          tags: v.array(v.string()),
          currentRevision: v.number(),
          updatedAt: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.read')

    const workspaceId = normalizeRequiredText(
      args.workspaceId,
      'workspaceId',
      componentLinkFieldLimits.workspaceId,
    )
    const latestGraph = await getLatestSuccessfulWorkspaceGraph(
      ctx.db,
      workspaceId,
    )

    if (!latestGraph) {
      return null
    }

    const component = await ctx.db.get(args.componentId)
    if (!component || component.versionId !== latestGraph.graphVersionId) {
      return null
    }

    const [project, dependencies, relatedLinks] = await Promise.all([
      ctx.db
        .query('componentGraphProjects')
        .withIndex('by_version_name', (queryBuilder) =>
          queryBuilder
            .eq('versionId', latestGraph.graphVersionId)
            .eq('name', component.project),
        )
        .unique(),
      ctx.db
        .query('componentGraphDependencies')
        .withIndex('by_version_id', (queryBuilder) =>
          queryBuilder.eq('versionId', latestGraph.graphVersionId),
        )
        .collect(),
      ctx.db
        .query('tipComponentLinks')
        .withIndex('by_workspace_component_file', (queryBuilder) =>
          queryBuilder
            .eq('workspaceId', workspaceId)
            .eq('projectName', component.project)
            .eq('componentName', component.name)
            .eq('componentFilePath', component.filePath),
        )
        .collect(),
    ])

    if (!project) {
      return null
    }

    const filteredLinks = relatedLinks.filter((link) => {
      if (!args.actorOrganizationId) {
        return true
      }

      return link.organizationId === args.actorOrganizationId
    })

    const relatedTipIds = [...new Set(filteredLinks.map((link) => link.tipId))]
    const relatedTips = await Promise.all(
      relatedTipIds.map((tipId) => ctx.db.get(tipId)),
    )

    const relatedPublishedTips = relatedTips
      .filter((tip): tip is Doc<'tips'> => {
        if (!tip || tip.status !== 'published') {
          return false
        }

        if (!args.actorOrganizationId) {
          return true
        }

        return tip.organizationId === args.actorOrganizationId
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((tip) => ({
        id: tip._id,
        slug: tip.slug,
        title: tip.title,
        project: tip.project ?? null,
        library: tip.library ?? null,
        component: tip.component ?? null,
        tags: tip.tags,
        currentRevision: tip.currentRevision,
        updatedAt: tip.updatedAt,
      }))

    return {
      workspaceId,
      graphVersionId: latestGraph.graphVersionId,
      graphVersionNumber: latestGraph.graphVersionNumber,
      component: {
        id: component._id,
        name: component.name,
        className: component.className,
        selector: component.selector,
        standalone: component.standalone,
        project: component.project,
        filePath: component.filePath,
        dependencies: [...component.dependencies].sort((left, right) =>
          left.localeCompare(right),
        ),
      },
      project: {
        name: project.name,
        type: project.type,
      },
      dependenciesOut: dependencies
        .filter((dependency) => dependency.sourceProject === component.project)
        .map((dependency) => ({
          sourceProject: dependency.sourceProject,
          targetProject: dependency.targetProject,
          viaFiles: [...dependency.viaFiles].sort((left, right) =>
            left.localeCompare(right),
          ),
        })),
      dependenciesIn: dependencies
        .filter((dependency) => dependency.targetProject === component.project)
        .map((dependency) => ({
          sourceProject: dependency.sourceProject,
          targetProject: dependency.targetProject,
          viaFiles: [...dependency.viaFiles].sort((left, right) =>
            left.localeCompare(right),
          ),
        })),
      relatedPublishedTips,
    }
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

export const getTipForEditor = query({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.object({
    tipId: v.id('tips'),
    symptom: v.string(),
    rootCause: v.string(),
    fix: v.string(),
    prevention: v.string(),
    project: v.union(v.string(), v.null()),
    library: v.union(v.string(), v.null()),
    component: v.union(v.string(), v.null()),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    status: tipStatusValidator,
    currentRevision: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const tip = await ctx.db.get(args.tipId)

    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    assertTipOrganizationAccess(tip, args.actorOrganizationId)

    return {
      tipId: tip._id,
      symptom: tip.symptom,
      rootCause: tip.rootCause,
      fix: tip.fix,
      prevention: tip.prevention,
      project: tip.project ?? null,
      library: tip.library ?? null,
      component: tip.component ?? null,
      tags: tip.tags,
      references: tip.references,
      status: tip.status,
      currentRevision: tip.currentRevision,
      updatedAt: tip.updatedAt,
    }
  },
})

export const listTipRevisions = query({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      revisionId: v.id('tipRevisions'),
      revisionNumber: v.number(),
      status: tipStatusValidator,
      editedByWorkosUserId: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const tip = await ctx.db.get(args.tipId)

    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    assertTipOrganizationAccess(tip, args.actorOrganizationId)

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
    const revisions = await ctx.db
      .query('tipRevisions')
      .withIndex('by_tip_id', (queryBuilder) => queryBuilder.eq('tipId', args.tipId))
      .collect()

    return revisions
      .sort((left, right) => right.revisionNumber - left.revisionNumber)
      .slice(0, limit)
      .map((revision) => ({
        revisionId: revision._id,
        revisionNumber: revision.revisionNumber,
        status: revision.status,
        editedByWorkosUserId: revision.editedByWorkosUserId,
        createdAt: revision.createdAt,
      }))
  },
})

export const listTipComponentLinksForEditor = query({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.array(
    v.object({
      workspaceId: v.string(),
      projectName: v.string(),
      componentName: v.string(),
      componentFilePath: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const tip = await ctx.db.get(args.tipId)
    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    assertTipOrganizationAccess(tip, args.actorOrganizationId)

    const links = await ctx.db
      .query('tipComponentLinks')
      .withIndex('by_tip_id', (queryBuilder) => queryBuilder.eq('tipId', args.tipId))
      .collect()

    return links
      .sort((left, right) => {
        const workspaceOrder = left.workspaceId.localeCompare(right.workspaceId)
        if (workspaceOrder !== 0) {
          return workspaceOrder
        }

        const projectOrder = left.projectName.localeCompare(right.projectName)
        if (projectOrder !== 0) {
          return projectOrder
        }

        const componentOrder = left.componentName.localeCompare(right.componentName)
        if (componentOrder !== 0) {
          return componentOrder
        }

        return left.componentFilePath.localeCompare(right.componentFilePath)
      })
      .map((link) => ({
        workspaceId: link.workspaceId,
        projectName: link.projectName,
        componentName: link.componentName,
        componentFilePath: link.componentFilePath,
        updatedAt: link.updatedAt,
      }))
  },
})

export const saveTipDraft = mutation({
  args: {
    ...actorContextShape,
    tipId: v.optional(v.id('tips')),
    symptom: v.string(),
    rootCause: v.string(),
    fix: v.string(),
    prevention: v.string(),
    project: v.optional(v.string()),
    library: v.optional(v.string()),
    component: v.optional(v.string()),
    tags: v.array(v.string()),
    references: v.array(v.string()),
    componentLinks: v.optional(v.array(tipComponentLinkInputValidator)),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.literal('draft'),
    revisionNumber: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const normalizedDraft = normalizeTipDraftInput({
      symptom: args.symptom,
      rootCause: args.rootCause,
      fix: args.fix,
      prevention: args.prevention,
      project: args.project,
      library: args.library,
      component: args.component,
      tags: args.tags,
      references: args.references,
    })
    const normalizedComponentLinks = args.componentLinks
      ? normalizeTipComponentLinks(args.componentLinks)
      : undefined

    const now = Date.now()
    const metadata = buildTipMetadata(normalizedDraft.symptom, now)
    const searchText = buildTipSearchText(metadata.title, normalizedDraft)
    let tipId: Id<'tips'>
    let revisionNumber = 1

    if (args.tipId) {
      const existingTip = await ctx.db.get(args.tipId)

      if (!existingTip) {
        throw new ConvexError('Tip not found.')
      }

      assertTipOrganizationAccess(existingTip, args.actorOrganizationId)
      assertStatusTransition(existingTip.status as TipStatus, 'draft')

      if (existingTip.status === 'in_review') {
        await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.publish')
      }

      revisionNumber = (existingTip.currentRevision ?? 0) + 1
      tipId = existingTip._id
      const organizationId = existingTip.organizationId ?? args.actorOrganizationId

      await ctx.db.patch(existingTip._id, {
        title: metadata.title,
        symptom: normalizedDraft.symptom,
        rootCause: normalizedDraft.rootCause,
        fix: normalizedDraft.fix,
        prevention: normalizedDraft.prevention,
        project: normalizedDraft.project,
        library: normalizedDraft.library,
        component: normalizedDraft.component,
        tags: normalizedDraft.tags,
        references: normalizedDraft.references,
        searchText,
        status: 'draft',
        organizationId,
        currentRevision: revisionNumber,
        updatedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })
    } else {
      tipId = await ctx.db.insert('tips', {
        slug: metadata.slug,
        title: metadata.title,
        symptom: normalizedDraft.symptom,
        rootCause: normalizedDraft.rootCause,
        fix: normalizedDraft.fix,
        prevention: normalizedDraft.prevention,
        project: normalizedDraft.project,
        library: normalizedDraft.library,
        component: normalizedDraft.component,
        tags: normalizedDraft.tags,
        references: normalizedDraft.references,
        searchText,
        status: 'draft',
        organizationId: args.actorOrganizationId,
        createdByWorkosUserId: args.actorWorkosUserId,
        createdAt: now,
        currentRevision: revisionNumber,
        updatedByWorkosUserId: args.actorWorkosUserId,
        updatedAt: now,
      })
    }

    const tip = await ctx.db.get(tipId)
    if (!tip) {
      throw new ConvexError('Tip not found after save.')
    }

    await appendTipRevisionSnapshot(ctx, {
      tip,
      revisionNumber,
      status: 'draft',
      editedByWorkosUserId: args.actorWorkosUserId,
      createdAt: now,
    })

    await replaceTipTagFacets(ctx, {
      tipId,
      organizationId: tip.organizationId,
      status: 'draft',
      tags: tip.tags,
      updatedAt: now,
    })

    if (normalizedComponentLinks) {
      await replaceTipComponentLinks(ctx, {
        tipId,
        organizationId: tip.organizationId,
        actorWorkosUserId: args.actorWorkosUserId,
        links: normalizedComponentLinks,
        now,
      })
    }

    return {
      tipId,
      status: 'draft' as const,
      revisionNumber,
      updatedAt: now,
    }
  },
})

export const submitTipForReview = mutation({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.literal('in_review'),
    revisionNumber: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.create')

    const tip = await ctx.db.get(args.tipId)
    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    assertTipOrganizationAccess(tip, args.actorOrganizationId)

    const now = Date.now()
    const revisionNumber = await patchTipStatusWithRevision(ctx, {
      tip,
      nextStatus: 'in_review',
      actorWorkosUserId: args.actorWorkosUserId,
      now,
    })

    return {
      tipId: tip._id,
      status: 'in_review' as const,
      revisionNumber,
    }
  },
})

export const returnTipToDraft = mutation({
  args: {
    ...actorContextShape,
    tipId: v.id('tips'),
  },
  returns: v.object({
    tipId: v.id('tips'),
    status: v.literal('draft'),
    revisionNumber: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx.db, args.actorWorkosUserId, 'tips.publish')

    const tip = await ctx.db.get(args.tipId)
    if (!tip) {
      throw new ConvexError('Tip not found.')
    }

    assertTipOrganizationAccess(tip, args.actorOrganizationId)

    const now = Date.now()
    const revisionNumber = await patchTipStatusWithRevision(ctx, {
      tip,
      nextStatus: 'draft',
      actorWorkosUserId: args.actorWorkosUserId,
      now,
    })

    return {
      tipId: tip._id,
      status: 'draft' as const,
      revisionNumber,
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
    revisionNumber: v.number(),
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

    assertTipOrganizationAccess(tip, args.actorOrganizationId)
    const now = Date.now()
    const revisionNumber = await patchTipStatusWithRevision(ctx, {
      tip,
      nextStatus: 'published',
      actorWorkosUserId: args.actorWorkosUserId,
      now,
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
      revisionNumber,
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
    revisionNumber: v.number(),
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

    assertTipOrganizationAccess(tip, args.actorOrganizationId)
    const now = Date.now()
    const revisionNumber = await patchTipStatusWithRevision(ctx, {
      tip,
      nextStatus: 'deprecated',
      actorWorkosUserId: args.actorWorkosUserId,
      now,
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
      revisionNumber,
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
