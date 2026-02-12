import { describe, expect, it } from 'vitest'

import {
  buildFailureDetails,
  computeSnapshotDigest,
  decideIngestionAttempt,
  normalizeIdempotencyKey,
  summarizeSnapshot,
  type AngularScanSnapshotPayload,
} from './scan-ingestion'

function buildSnapshotFixture(): AngularScanSnapshotPayload {
  return {
    schemaVersion: 1,
    workspaceConfigPath: 'angular.json',
    projects: [
      {
        name: 'portal',
        type: 'application',
        rootPath: 'apps/portal',
        sourceRootPath: 'apps/portal/src',
        configFilePath: 'angular.json',
        dependencies: ['ui-kit'],
      },
      {
        name: 'ui-kit',
        type: 'library',
        rootPath: 'libs/ui-kit',
        sourceRootPath: 'libs/ui-kit/src',
        configFilePath: 'angular.json',
        dependencies: [],
      },
    ],
    libs: [
      {
        name: 'ui-kit',
        rootPath: 'libs/ui-kit',
        sourceRootPath: 'libs/ui-kit/src',
        configFilePath: 'angular.json',
      },
    ],
    components: [
      {
        name: 'AppComponent',
        className: 'AppComponent',
        selector: 'bd-root',
        standalone: true,
        project: 'portal',
        filePath: 'apps/portal/src/app/app.component.ts',
        dependencies: ['ui-kit'],
      },
    ],
    dependencies: [
      {
        sourceProject: 'portal',
        targetProject: 'ui-kit',
        viaFiles: ['apps/portal/src/app/app.component.ts'],
      },
    ],
  }
}

describe('scan ingestion idempotency + retry decisions', () => {
  it('returns conflict when payload hash changes for the same key', () => {
    const decision = decideIngestionAttempt(
      {
        status: 'failed',
        payloadHash: 'hash-A',
      },
      'hash-B',
    )

    expect(decision.type).toBe('conflict')
    expect(decision).toEqual({
      type: 'conflict',
      reason:
        'Idempotency key reuse detected with a different scanner snapshot payload.',
    })
  })

  it('allows retry after a failed ingest with matching payload hash', () => {
    const decision = decideIngestionAttempt(
      {
        status: 'failed',
        payloadHash: 'same-hash',
      },
      'same-hash',
    )

    expect(decision).toEqual({ type: 'acquire_retry' })
  })

  it('treats succeeded ingests as deduplicated retries', () => {
    const decision = decideIngestionAttempt(
      {
        status: 'succeeded',
        payloadHash: 'same-hash',
      },
      'same-hash',
    )

    expect(decision).toEqual({ type: 'deduplicated_success' })
  })
})

describe('scan ingestion failure details', () => {
  it('normalizes error code and message for failure persistence', () => {
    const error = new Error('  upstream timed out  ') as Error & { code?: string }
    error.code = 'scanner-timeout'

    expect(buildFailureDetails(error)).toEqual({
      code: 'SCANNER_TIMEOUT',
      message: 'upstream timed out',
    })
  })

  it('falls back to default message for unsupported thrown values', () => {
    expect(buildFailureDetails({ unexpected: true })).toEqual({
      code: 'INGESTION_FAILED',
      message: 'Scanner snapshot ingestion failed.',
    })
  })
})

describe('scan ingestion digest + summary', () => {
  it('computes a deterministic digest for equivalent snapshots', () => {
    const snapshot = buildSnapshotFixture()
    const digestA = computeSnapshotDigest({
      workspaceId: 'media-press/hubert',
      scannerName: 'angular-scanner',
      scannerVersion: '1.2.3',
      snapshot,
    })

    const digestB = computeSnapshotDigest({
      workspaceId: 'media-press/hubert',
      scannerVersion: '1.2.3',
      scannerName: 'angular-scanner',
      snapshot: {
        ...snapshot,
        projects: [...snapshot.projects],
      },
    })

    expect(digestA).toBe(digestB)
  })

  it('summarizes project/library/component/dependency counts', () => {
    const summary = summarizeSnapshot(buildSnapshotFixture())

    expect(summary).toEqual({
      projectCount: 2,
      libraryCount: 1,
      componentCount: 1,
      dependencyCount: 1,
    })
  })
})

describe('scan ingestion key normalization', () => {
  it('rejects empty idempotency keys', () => {
    expect(() => normalizeIdempotencyKey('   ')).toThrowError(
      'idempotencyKey is required.',
    )
  })
})
