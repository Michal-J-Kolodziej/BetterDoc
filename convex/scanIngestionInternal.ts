import { ConvexError, v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import { decideIngestionAttempt } from '../src/lib/scan-ingestion'

export const scanIngestionSourceValidator = v.union(
  v.literal('manual'),
  v.literal('pipeline'),
  v.literal('scheduled'),
)

export const scanIngestionMetadataValidator = v.optional(
  v.object({
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    runId: v.optional(v.string()),
  }),
)

const angularScanProjectValidator = v.object({
  name: v.string(),
  type: v.union(v.literal('application'), v.literal('library')),
  rootPath: v.string(),
  sourceRootPath: v.union(v.string(), v.null()),
  configFilePath: v.string(),
  dependencies: v.array(v.string()),
})

const angularScanLibraryValidator = v.object({
  name: v.string(),
  rootPath: v.string(),
  sourceRootPath: v.union(v.string(), v.null()),
  configFilePath: v.string(),
})

const angularScanComponentValidator = v.object({
  name: v.string(),
  className: v.union(v.string(), v.null()),
  selector: v.union(v.string(), v.null()),
  standalone: v.union(v.boolean(), v.null()),
  project: v.string(),
  filePath: v.string(),
  dependencies: v.array(v.string()),
})

const angularScanDependencyValidator = v.object({
  sourceProject: v.string(),
  targetProject: v.string(),
  viaFiles: v.array(v.string()),
})

export const angularScanSnapshotValidator = v.object({
  schemaVersion: v.literal(1),
  workspaceConfigPath: v.string(),
  projects: v.array(angularScanProjectValidator),
  libs: v.array(angularScanLibraryValidator),
  components: v.array(angularScanComponentValidator),
  dependencies: v.array(angularScanDependencyValidator),
})

export const scanRunAcquireResultValidator = v.union(
  v.object({
    outcome: v.literal('acquired'),
    scanRunId: v.id('scanRuns'),
    attemptCount: v.number(),
  }),
  v.object({
    outcome: v.literal('deduplicated'),
    scanRunId: v.id('scanRuns'),
    graphVersionId: v.id('componentGraphVersions'),
    graphVersionNumber: v.number(),
    attemptCount: v.number(),
  }),
  v.object({
    outcome: v.literal('in_progress'),
    scanRunId: v.id('scanRuns'),
    attemptCount: v.number(),
  }),
)

type ScanRunStatus = Doc<'scanRuns'>['status']

export const acquireScanRunForIngestion = internalMutation({
  args: {
    idempotencyKey: v.string(),
    payloadHash: v.string(),
    workspaceId: v.string(),
    source: scanIngestionSourceValidator,
    scannerName: v.string(),
    scannerVersion: v.optional(v.string()),
    metadata: scanIngestionMetadataValidator,
    projectCount: v.number(),
    libraryCount: v.number(),
    componentCount: v.number(),
    dependencyCount: v.number(),
  },
  returns: scanRunAcquireResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now()
    const existingRun = await ctx.db
      .query('scanRuns')
      .withIndex('by_idempotency_key', (queryBuilder) =>
        queryBuilder.eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()

    const decision = decideIngestionAttempt(
      existingRun
        ? {
            status: existingRun.status as ScanRunStatus,
            payloadHash: existingRun.payloadHash,
          }
        : null,
      args.payloadHash,
    )

    if (decision.type === 'conflict') {
      throw new ConvexError(decision.reason)
    }

    if (!existingRun) {
      const scanRunId = await ctx.db.insert('scanRuns', {
        idempotencyKey: args.idempotencyKey,
        payloadHash: args.payloadHash,
        workspaceId: args.workspaceId,
        scannerName: args.scannerName,
        scannerVersion: args.scannerVersion,
        source: args.source,
        status: 'processing',
        attemptCount: 1,
        projectCount: args.projectCount,
        libraryCount: args.libraryCount,
        componentCount: args.componentCount,
        dependencyCount: args.dependencyCount,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: 0,
      })

      return {
        outcome: 'acquired' as const,
        scanRunId,
        attemptCount: 1,
      }
    }

    if (decision.type === 'deduplicated_success') {
      if (
        !existingRun.graphVersionId ||
        typeof existingRun.graphVersionNumber !== 'number'
      ) {
        throw new ConvexError(
          'scanRuns record is inconsistent: succeeded run has no graph version linkage.',
        )
      }

      return {
        outcome: 'deduplicated' as const,
        scanRunId: existingRun._id,
        graphVersionId: existingRun.graphVersionId,
        graphVersionNumber: existingRun.graphVersionNumber,
        attemptCount: existingRun.attemptCount,
      }
    }

    if (decision.type === 'in_progress') {
      return {
        outcome: 'in_progress' as const,
        scanRunId: existingRun._id,
        attemptCount: existingRun.attemptCount,
      }
    }

    const nextAttemptCount = existingRun.attemptCount + 1
    await ctx.db.patch(existingRun._id, {
      payloadHash: args.payloadHash,
      workspaceId: args.workspaceId,
      scannerName: args.scannerName,
      scannerVersion: args.scannerVersion,
      source: args.source,
      status: 'processing',
      attemptCount: nextAttemptCount,
      graphVersionId: undefined,
      graphVersionNumber: undefined,
      projectCount: args.projectCount,
      libraryCount: args.libraryCount,
      componentCount: args.componentCount,
      dependencyCount: args.dependencyCount,
      metadata: args.metadata,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: now,
      startedAt: now,
      completedAt: 0,
    })

    return {
      outcome: 'acquired' as const,
      scanRunId: existingRun._id,
      attemptCount: nextAttemptCount,
    }
  },
})

export const finalizeScanRunSuccess = internalMutation({
  args: {
    scanRunId: v.id('scanRuns'),
    workspaceId: v.string(),
    payloadHash: v.string(),
    snapshot: angularScanSnapshotValidator,
  },
  returns: v.object({
    scanRunId: v.id('scanRuns'),
    graphVersionId: v.id('componentGraphVersions'),
    graphVersionNumber: v.number(),
    attemptCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const scanRun = await ctx.db.get(args.scanRunId)

    if (!scanRun) {
      throw new ConvexError('Scan run not found.')
    }

    if (scanRun.workspaceId !== args.workspaceId) {
      throw new ConvexError(
        'workspaceId does not match the workspace for this scan run.',
      )
    }

    if (scanRun.payloadHash !== args.payloadHash) {
      throw new ConvexError('payload hash mismatch for this scan run.')
    }

    if (scanRun.status === 'succeeded') {
      if (!scanRun.graphVersionId || typeof scanRun.graphVersionNumber !== 'number') {
        throw new ConvexError(
          'scanRuns record is inconsistent: succeeded run has no graph version linkage.',
        )
      }

      return {
        scanRunId: scanRun._id,
        graphVersionId: scanRun.graphVersionId,
        graphVersionNumber: scanRun.graphVersionNumber,
        attemptCount: scanRun.attemptCount,
      }
    }

    if (scanRun.status !== 'processing') {
      throw new ConvexError(
        `Scan run cannot be finalized from status "${scanRun.status}".`,
      )
    }

    const graphHead = await ctx.db
      .query('componentGraphHeads')
      .withIndex('by_workspace_id', (queryBuilder) =>
        queryBuilder.eq('workspaceId', args.workspaceId),
      )
      .unique()

    const nextVersion = graphHead ? graphHead.latestVersion + 1 : 1

    if (graphHead) {
      await ctx.db.patch(graphHead._id, {
        latestVersion: nextVersion,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('componentGraphHeads', {
        workspaceId: args.workspaceId,
        latestVersion: nextVersion,
        updatedAt: now,
      })
    }

    const graphVersionId = await ctx.db.insert('componentGraphVersions', {
      workspaceId: args.workspaceId,
      version: nextVersion,
      scanRunId: scanRun._id,
      payloadHash: args.payloadHash,
      schemaVersion: args.snapshot.schemaVersion,
      workspaceConfigPath: args.snapshot.workspaceConfigPath,
      projectCount: args.snapshot.projects.length,
      libraryCount: args.snapshot.libs.length,
      componentCount: args.snapshot.components.length,
      dependencyCount: args.snapshot.dependencies.length,
      createdAt: now,
    })

    for (const project of args.snapshot.projects) {
      await ctx.db.insert('componentGraphProjects', {
        versionId: graphVersionId,
        name: project.name,
        type: project.type,
        rootPath: project.rootPath,
        sourceRootPath: project.sourceRootPath,
        configFilePath: project.configFilePath,
        dependencies: project.dependencies,
      })
    }

    for (const component of args.snapshot.components) {
      await ctx.db.insert('componentGraphComponents', {
        versionId: graphVersionId,
        name: component.name,
        className: component.className,
        selector: component.selector,
        standalone: component.standalone,
        project: component.project,
        filePath: component.filePath,
        dependencies: component.dependencies,
      })
    }

    for (const dependency of args.snapshot.dependencies) {
      await ctx.db.insert('componentGraphDependencies', {
        versionId: graphVersionId,
        sourceProject: dependency.sourceProject,
        targetProject: dependency.targetProject,
        viaFiles: dependency.viaFiles,
      })
    }

    await ctx.db.patch(scanRun._id, {
      status: 'succeeded',
      graphVersionId,
      graphVersionNumber: nextVersion,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: now,
      completedAt: now,
    })

    return {
      scanRunId: scanRun._id,
      graphVersionId,
      graphVersionNumber: nextVersion,
      attemptCount: scanRun.attemptCount,
    }
  },
})

export const markScanRunFailed = internalMutation({
  args: {
    scanRunId: v.id('scanRuns'),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('failed'), v.literal('succeeded')),
  }),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId)

    if (!scanRun) {
      throw new ConvexError('Scan run not found.')
    }

    if (scanRun.status === 'succeeded') {
      return { status: 'succeeded' as const }
    }

    const now = Date.now()
    await ctx.db.patch(scanRun._id, {
      status: 'failed',
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      updatedAt: now,
      completedAt: now,
    })

    return { status: 'failed' as const }
  },
})
