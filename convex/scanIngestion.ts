import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, query } from './_generated/server'
import {
  buildFailureDetails,
  computeSnapshotDigest,
  normalizeIdempotencyKey,
  normalizeWorkspaceId,
  summarizeSnapshot,
  type ScanIngestionMetadata,
  type ScanIngestionSource,
} from '../src/lib/scan-ingestion'
import {
  angularScanSnapshotValidator,
  scanIngestionMetadataValidator,
  scanIngestionSourceValidator,
} from './scanIngestionInternal'

const scanIngestionResultValidator = v.object({
  status: v.union(v.literal('processing'), v.literal('succeeded')),
  deduplicated: v.boolean(),
  scanRunId: v.id('scanRuns'),
  graphVersionId: v.union(v.id('componentGraphVersions'), v.null()),
  graphVersionNumber: v.union(v.number(), v.null()),
  attemptCount: v.number(),
})

const latestSuccessfulScanRunValidator = v.union(
  v.object({
    scanRunId: v.id('scanRuns'),
    workspaceId: v.string(),
    graphVersionId: v.id('componentGraphVersions'),
    graphVersionNumber: v.number(),
    payloadHash: v.string(),
    scannerName: v.string(),
    scannerVersion: v.union(v.string(), v.null()),
    source: scanIngestionSourceValidator,
    attemptCount: v.number(),
    projectCount: v.number(),
    libraryCount: v.number(),
    componentCount: v.number(),
    dependencyCount: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),
  }),
  v.null(),
)

type SanitizedIngestionInput = {
  idempotencyKey: string
  workspaceId: string
  source: ScanIngestionSource
  scannerName: string
  scannerVersion?: string
  metadata?: ScanIngestionMetadata
}

type AcquireScanRunResult =
  | {
      outcome: 'acquired'
      scanRunId: Id<'scanRuns'>
      attemptCount: number
    }
  | {
      outcome: 'deduplicated'
      scanRunId: Id<'scanRuns'>
      graphVersionId: Id<'componentGraphVersions'>
      graphVersionNumber: number
      attemptCount: number
    }
  | {
      outcome: 'in_progress'
      scanRunId: Id<'scanRuns'>
      attemptCount: number
    }

type FinalizeScanRunResult = {
  scanRunId: Id<'scanRuns'>
  graphVersionId: Id<'componentGraphVersions'>
  graphVersionNumber: number
  attemptCount: number
}

type IngestionActionResult = {
  status: 'processing' | 'succeeded'
  deduplicated: boolean
  scanRunId: Id<'scanRuns'>
  graphVersionId: Id<'componentGraphVersions'> | null
  graphVersionNumber: number | null
  attemptCount: number
}

function trimOptional(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function sanitizeMetadata(
  metadata: ScanIngestionMetadata | undefined,
): ScanIngestionMetadata | undefined {
  if (!metadata) {
    return undefined
  }

  const sanitized: ScanIngestionMetadata = {}

  const branch = trimOptional(metadata.branch)
  if (branch) {
    sanitized.branch = branch
  }

  const commitSha = trimOptional(metadata.commitSha)
  if (commitSha) {
    sanitized.commitSha = commitSha
  }

  const runId = trimOptional(metadata.runId)
  if (runId) {
    sanitized.runId = runId
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function sanitizeIngestionInput(args: {
  idempotencyKey: string
  workspaceId: string
  source: ScanIngestionSource | undefined
  scanner: { name: string; version?: string }
  metadata: ScanIngestionMetadata | undefined
}): SanitizedIngestionInput {
  const idempotencyKey = normalizeIdempotencyKey(args.idempotencyKey)
  const workspaceId = normalizeWorkspaceId(args.workspaceId)
  const scannerName = args.scanner.name.trim()

  if (!scannerName) {
    throw new ConvexError('scanner.name is required.')
  }

  return {
    idempotencyKey,
    workspaceId,
    source: args.source ?? 'manual',
    scannerName,
    scannerVersion: trimOptional(args.scanner.version),
    metadata: sanitizeMetadata(args.metadata),
  }
}

export const ingestScannerSnapshot = action({
  args: {
    idempotencyKey: v.string(),
    workspaceId: v.string(),
    source: v.optional(scanIngestionSourceValidator),
    scanner: v.object({
      name: v.string(),
      version: v.optional(v.string()),
    }),
    metadata: scanIngestionMetadataValidator,
    snapshot: angularScanSnapshotValidator,
  },
  returns: scanIngestionResultValidator,
  handler: async (ctx, args): Promise<IngestionActionResult> => {
    let sanitizedInput: SanitizedIngestionInput

    try {
      sanitizedInput = sanitizeIngestionInput({
        idempotencyKey: args.idempotencyKey,
        workspaceId: args.workspaceId,
        source: args.source,
        scanner: args.scanner,
        metadata: args.metadata,
      })
    } catch (error) {
      const details = buildFailureDetails(error)
      throw new ConvexError(details.message)
    }

    const snapshotSummary = summarizeSnapshot(args.snapshot)
    const payloadHash = computeSnapshotDigest({
      workspaceId: sanitizedInput.workspaceId,
      scannerName: sanitizedInput.scannerName,
      scannerVersion: sanitizedInput.scannerVersion,
      snapshot: args.snapshot,
    })

    const acquisition: AcquireScanRunResult = await ctx.runMutation(
      internal.scanIngestionInternal.acquireScanRunForIngestion,
      {
        idempotencyKey: sanitizedInput.idempotencyKey,
        payloadHash,
        workspaceId: sanitizedInput.workspaceId,
        source: sanitizedInput.source,
        scannerName: sanitizedInput.scannerName,
        scannerVersion: sanitizedInput.scannerVersion,
        metadata: sanitizedInput.metadata,
        ...snapshotSummary,
      },
    )

    if (acquisition.outcome === 'deduplicated') {
      return {
        status: 'succeeded',
        deduplicated: true,
        scanRunId: acquisition.scanRunId,
        graphVersionId: acquisition.graphVersionId,
        graphVersionNumber: acquisition.graphVersionNumber,
        attemptCount: acquisition.attemptCount,
      }
    }

    if (acquisition.outcome === 'in_progress') {
      return {
        status: 'processing',
        deduplicated: true,
        scanRunId: acquisition.scanRunId,
        graphVersionId: null,
        graphVersionNumber: null,
        attemptCount: acquisition.attemptCount,
      }
    }

    try {
      const finalized: FinalizeScanRunResult = await ctx.runMutation(
        internal.scanIngestionInternal.finalizeScanRunSuccess,
        {
          scanRunId: acquisition.scanRunId,
          workspaceId: sanitizedInput.workspaceId,
          payloadHash,
          snapshot: args.snapshot,
        },
      )

      return {
        status: 'succeeded',
        deduplicated: false,
        scanRunId: finalized.scanRunId,
        graphVersionId: finalized.graphVersionId,
        graphVersionNumber: finalized.graphVersionNumber,
        attemptCount: finalized.attemptCount,
      }
    } catch (error) {
      const failureDetails = buildFailureDetails(error)
      await ctx.runMutation(internal.scanIngestionInternal.markScanRunFailed, {
        scanRunId: acquisition.scanRunId,
        errorCode: failureDetails.code,
        errorMessage: failureDetails.message,
      })

      throw new ConvexError(`[${failureDetails.code}] ${failureDetails.message}`)
    }
  },
})

export const getLatestSuccessfulScanRun = query({
  args: {
    workspaceId: v.string(),
  },
  returns: latestSuccessfulScanRunValidator,
  handler: async (ctx, args) => {
    const workspaceId = normalizeWorkspaceId(args.workspaceId)
    const matchingRuns = await ctx.db
      .query('scanRuns')
      .withIndex('by_workspace_status_started_at', (queryBuilder) =>
        queryBuilder.eq('workspaceId', workspaceId).eq('status', 'succeeded'),
      )
      .order('desc')
      .take(1)

    const latestRun = matchingRuns[0]
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
      scanRunId: latestRun._id,
      workspaceId: latestRun.workspaceId,
      graphVersionId: latestRun.graphVersionId,
      graphVersionNumber: latestRun.graphVersionNumber,
      payloadHash: latestRun.payloadHash,
      scannerName: latestRun.scannerName,
      scannerVersion: latestRun.scannerVersion ?? null,
      source: latestRun.source,
      attemptCount: latestRun.attemptCount,
      projectCount: latestRun.projectCount,
      libraryCount: latestRun.libraryCount,
      componentCount: latestRun.componentCount,
      dependencyCount: latestRun.dependencyCount,
      startedAt: latestRun.startedAt,
      completedAt: latestRun.completedAt,
    }
  },
})
