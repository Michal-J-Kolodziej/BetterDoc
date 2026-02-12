import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

type AngularSnapshot = {
  schemaVersion: number
  projects: unknown[]
  libs: unknown[]
  components: unknown[]
  dependencies: unknown[]
  [key: string]: unknown
}

type IngestionSource = 'manual' | 'pipeline' | 'scheduled'

type IngestionPayload = {
  idempotencyKey: string
  workspaceId: string
  source: IngestionSource
  scanner: {
    name: string
    version?: string
  }
  metadata?: {
    branch?: string
    commitSha?: string
    runId?: string
  }
  snapshot: AngularSnapshot
}

type HttpResult = {
  status: number
  bodyText: string
}

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_INITIAL_BACKOFF_MS = 2_000
const DEFAULT_MAX_BACKOFF_MS = 15_000
const MAX_IDEMPOTENCY_KEY_LENGTH = 128
const MAX_WORKSPACE_ID_LENGTH = 128

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Environment variable ${name} is required.`)
  }

  return value
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : undefined
}

function parsePositiveInteger(name: string, fallback: number): number {
  const rawValue = readOptionalEnv(name)
  if (!rawValue) {
    return fallback
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer when provided.`)
  }

  return parsed
}

function sanitizeIdempotencyKey(key: string): string {
  const sanitized = key.replace(/[^A-Za-z0-9._:-]/g, '-')

  if (sanitized.length === 0) {
    throw new Error(
      'INGEST_IDEMPOTENCY_KEY must contain at least one valid character.',
    )
  }

  return sanitized.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH)
}

function deriveIdempotencyKey(): string {
  const explicit = readOptionalEnv('INGEST_IDEMPOTENCY_KEY')
  if (explicit) {
    return sanitizeIdempotencyKey(explicit)
  }

  const buildReason = (readOptionalEnv('BUILD_REASON') ?? 'manual').toLowerCase()
  const buildId = readOptionalEnv('BUILD_BUILDID') ?? 'local'
  const jobAttempt = readOptionalEnv('SYSTEM_JOBATTEMPT') ?? '1'

  return sanitizeIdempotencyKey(
    `azdo-${buildReason}-${buildId}-attempt-${jobAttempt}`,
  )
}

function deriveWorkspaceId(): string {
  const explicit = readOptionalEnv('SCAN_WORKSPACE_ID')
  if (explicit) {
    return explicit.slice(0, MAX_WORKSPACE_ID_LENGTH)
  }

  const teamProject = readOptionalEnv('SYSTEM_TEAMPROJECT') ?? 'local'
  const repositoryName = readOptionalEnv('BUILD_REPOSITORY_NAME') ?? 'workspace'

  return `${teamProject}/${repositoryName}`.slice(0, MAX_WORKSPACE_ID_LENGTH)
}

function deriveIngestionSource(): IngestionSource {
  const source = readOptionalEnv('INGEST_SOURCE') ?? 'pipeline'

  if (source === 'manual' || source === 'pipeline' || source === 'scheduled') {
    return source
  }

  throw new Error(
    'INGEST_SOURCE must be one of: manual, pipeline, scheduled.',
  )
}

function deriveMetadata(): IngestionPayload['metadata'] {
  const branch =
    readOptionalEnv('INGEST_BRANCH') ??
    readOptionalEnv('BUILD_SOURCEBRANCHNAME') ??
    readOptionalEnv('BUILD_SOURCEBRANCH')
  const commitSha =
    readOptionalEnv('INGEST_COMMIT_SHA') ?? readOptionalEnv('BUILD_SOURCEVERSION')
  const runId = readOptionalEnv('INGEST_RUN_ID') ?? readOptionalEnv('BUILD_BUILDID')

  const metadata: NonNullable<IngestionPayload['metadata']> = {}

  if (branch) {
    metadata.branch = branch
  }

  if (commitSha) {
    metadata.commitSha = commitSha
  }

  if (runId) {
    metadata.runId = runId
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function isRetryableRequestError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof TypeError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return /(network|timed out|timeout|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed)/i.test(
    error.message,
  )
}

function computeRetryDelayMs(
  attempt: number,
  initialBackoffMs: number,
  maxBackoffMs: number,
): number {
  const exponential = initialBackoffMs * 2 ** Math.max(attempt - 1, 0)
  return Math.min(exponential, maxBackoffMs)
}

function formatResponseBody(bodyText: string): string {
  const normalized = bodyText.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) {
    return 'empty response body'
  }

  return normalized.length > 500
    ? `${normalized.slice(0, 500)}...`
    : normalized
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function readSnapshotFile(snapshotPath: string): Promise<AngularSnapshot> {
  const raw = await readFile(snapshotPath, 'utf8')
  const parsed: unknown = JSON.parse(raw)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Snapshot JSON must be an object.')
  }

  const snapshot = parsed as Partial<AngularSnapshot>
  if (snapshot.schemaVersion !== 1) {
    throw new Error('Snapshot schemaVersion must be 1.')
  }

  if (
    !Array.isArray(snapshot.projects) ||
    !Array.isArray(snapshot.libs) ||
    !Array.isArray(snapshot.components) ||
    !Array.isArray(snapshot.dependencies)
  ) {
    throw new Error(
      'Snapshot JSON must include array fields: projects, libs, components, dependencies.',
    )
  }

  return parsed as AngularSnapshot
}

async function postJsonWithTimeout(
  url: string,
  payload: string,
  timeoutMs: number,
  bearerToken?: string,
): Promise<HttpResult> {
  const abortController = new AbortController()
  let requestTimedOut = false

  const timeoutHandle = setTimeout(() => {
    requestTimedOut = true
    abortController.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: payload,
      signal: abortController.signal,
    })

    const bodyText = await response.text()
    return {
      status: response.status,
      bodyText,
    }
  } catch (error) {
    if (requestTimedOut) {
      throw new Error(`Request timed out after ${timeoutMs} ms.`)
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function run(): Promise<void> {
  const ingestUrl = readRequiredEnv('CONVEX_INGEST_URL')
  const snapshotPath =
    readOptionalEnv('SCAN_SNAPSHOT_FILE') ??
    path.join(process.cwd(), 'scan-snapshot.json')
  const scannerName = readOptionalEnv('SCANNER_NAME') ?? 'angular-scanner'
  const scannerVersion = readOptionalEnv('SCANNER_VERSION')
  const bearerToken = readOptionalEnv('CONVEX_INGEST_BEARER_TOKEN')

  const maxAttempts = parsePositiveInteger('INGEST_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
  const timeoutMs = parsePositiveInteger('INGEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const initialBackoffMs = parsePositiveInteger(
    'INGEST_INITIAL_BACKOFF_MS',
    DEFAULT_INITIAL_BACKOFF_MS,
  )
  const maxBackoffMs = parsePositiveInteger(
    'INGEST_MAX_BACKOFF_MS',
    DEFAULT_MAX_BACKOFF_MS,
  )

  const snapshot = await readSnapshotFile(snapshotPath)
  const metadata = deriveMetadata()
  const payload: IngestionPayload = {
    idempotencyKey: deriveIdempotencyKey(),
    workspaceId: deriveWorkspaceId(),
    source: deriveIngestionSource(),
    scanner: {
      name: scannerName,
      ...(scannerVersion ? { version: scannerVersion } : {}),
    },
    ...(metadata ? { metadata } : {}),
    snapshot,
  }

  const serializedPayload = JSON.stringify(payload)

  process.stdout.write(
    `[scan-ingestion] Posting snapshot from ${snapshotPath} for workspace ${payload.workspaceId} with idempotency key ${payload.idempotencyKey}.\n`,
  )

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const label = `[scan-ingestion][attempt ${attempt}/${maxAttempts}]`

    try {
      const response = await postJsonWithTimeout(
        ingestUrl,
        serializedPayload,
        timeoutMs,
        bearerToken,
      )

      if (response.status === 200 || response.status === 202) {
        process.stdout.write(
          `${label} Completed with HTTP ${response.status}: ${formatResponseBody(response.bodyText)}\n`,
        )
        return
      }

      const bodySummary = formatResponseBody(response.bodyText)
      const retryable = TRANSIENT_HTTP_STATUSES.has(response.status)

      if (!retryable || attempt === maxAttempts) {
        throw new Error(
          `HTTP ${response.status} from scanner ingestion endpoint: ${bodySummary}`,
        )
      }

      const delayMs = computeRetryDelayMs(
        attempt,
        initialBackoffMs,
        maxBackoffMs,
      )
      process.stderr.write(
        `${label} Transient HTTP ${response.status}. Retrying in ${delayMs} ms.\n`,
      )
      await sleep(delayMs)
      continue
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = isRetryableRequestError(error)

      if (!retryable || attempt === maxAttempts) {
        throw new Error(`${label} ${message}`)
      }

      const delayMs = computeRetryDelayMs(attempt, initialBackoffMs, maxBackoffMs)
      process.stderr.write(
        `${label} ${message}. Retrying in ${delayMs} ms.\n`,
      )
      await sleep(delayMs)
    }
  }

  throw new Error('Exhausted ingestion attempts without a terminal result.')
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[scan-ingestion] ${message}\n`)
  process.exit(1)
})
