export type ScanIngestionSource = 'manual' | 'pipeline' | 'scheduled'

export type AngularScanProject = {
  name: string
  type: 'application' | 'library'
  rootPath: string
  sourceRootPath: string | null
  configFilePath: string
  dependencies: string[]
}

export type AngularScanLibrary = {
  name: string
  rootPath: string
  sourceRootPath: string | null
  configFilePath: string
}

export type AngularScanComponent = {
  name: string
  className: string | null
  selector: string | null
  standalone: boolean | null
  project: string
  filePath: string
  dependencies: string[]
}

export type AngularScanDependency = {
  sourceProject: string
  targetProject: string
  viaFiles: string[]
}

export type AngularScanSnapshotPayload = {
  schemaVersion: 1
  workspaceConfigPath: string
  projects: AngularScanProject[]
  libs: AngularScanLibrary[]
  components: AngularScanComponent[]
  dependencies: AngularScanDependency[]
}

export type ScanIngestionMetadata = {
  branch?: string
  commitSha?: string
  runId?: string
}

export type ExistingScanRunIdentity = {
  status: 'processing' | 'succeeded' | 'failed'
  payloadHash: string
}

export type IngestionAcquireDecision =
  | { type: 'acquire_new' }
  | { type: 'acquire_retry' }
  | { type: 'deduplicated_success' }
  | { type: 'in_progress' }
  | { type: 'conflict'; reason: string }

export type ScanSnapshotSummary = {
  projectCount: number
  libraryCount: number
  componentCount: number
  dependencyCount: number
}

export type FailureDetails = {
  code: string
  message: string
}

const defaultFailureMessage = 'Scanner snapshot ingestion failed.'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return `{${entries
    .map(
      ([entryKey, entryValue]) =>
        `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`,
    )
    .join(',')}}`
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash.toString(16).padStart(8, '0')
}

function normalizeFailureCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) {
    return 'INGESTION_FAILED'
  }

  return normalized.slice(0, 64)
}

function normalizeFailureMessage(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return defaultFailureMessage
  }

  if (normalized.length > 512) {
    return `${normalized.slice(0, 509)}...`
  }

  return normalized
}

export function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error('idempotencyKey is required.')
  }

  if (normalized.length > 128) {
    throw new Error('idempotencyKey must be 128 characters or fewer.')
  }

  return normalized
}

export function normalizeWorkspaceId(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error('workspaceId is required.')
  }

  if (normalized.length > 128) {
    throw new Error('workspaceId must be 128 characters or fewer.')
  }

  return normalized
}

export function summarizeSnapshot(
  snapshot: AngularScanSnapshotPayload,
): ScanSnapshotSummary {
  return {
    projectCount: snapshot.projects.length,
    libraryCount: snapshot.libs.length,
    componentCount: snapshot.components.length,
    dependencyCount: snapshot.dependencies.length,
  }
}

export function decideIngestionAttempt(
  existing: ExistingScanRunIdentity | null,
  payloadHash: string,
): IngestionAcquireDecision {
  if (!existing) {
    return { type: 'acquire_new' }
  }

  if (existing.payloadHash !== payloadHash) {
    return {
      type: 'conflict',
      reason:
        'Idempotency key reuse detected with a different scanner snapshot payload.',
    }
  }

  if (existing.status === 'succeeded') {
    return { type: 'deduplicated_success' }
  }

  if (existing.status === 'processing') {
    return { type: 'in_progress' }
  }

  return { type: 'acquire_retry' }
}

export function computeSnapshotDigest(args: {
  workspaceId: string
  scannerName: string
  scannerVersion?: string
  snapshot: AngularScanSnapshotPayload
}): string {
  const canonicalPayload = stableStringify({
    workspaceId: args.workspaceId,
    scannerName: args.scannerName,
    scannerVersion: args.scannerVersion,
    snapshot: args.snapshot,
  })

  return fnv1a32(canonicalPayload)
}

export function buildFailureDetails(error: unknown): FailureDetails {
  if (typeof error === 'string') {
    return {
      code: 'INGESTION_FAILED',
      message: normalizeFailureMessage(error),
    }
  }

  if (error instanceof Error) {
    const maybeCode = (error as { code?: unknown }).code
    const code =
      typeof maybeCode === 'string'
        ? normalizeFailureCode(maybeCode)
        : 'INGESTION_FAILED'

    return {
      code,
      message: normalizeFailureMessage(error.message),
    }
  }

  return {
    code: 'INGESTION_FAILED',
    message: defaultFailureMessage,
  }
}
