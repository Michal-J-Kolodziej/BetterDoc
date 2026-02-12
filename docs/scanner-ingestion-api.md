# BetterDoc Scanner Ingestion API (BD-011)

Last updated: 2026-02-12

## Endpoint
- `POST /scanner/ingest`

## Request body

```json
{
  "idempotencyKey": "azure-run-1421-attempt-1",
  "workspaceId": "media-press/hubert",
  "source": "pipeline",
  "scanner": {
    "name": "angular-scanner",
    "version": "1.0.0"
  },
  "metadata": {
    "branch": "main",
    "commitSha": "abc123",
    "runId": "1421"
  },
  "snapshot": {
    "schemaVersion": 1,
    "workspaceConfigPath": "angular.json",
    "projects": [],
    "libs": [],
    "components": [],
    "dependencies": []
  }
}
```

Field notes:
- `idempotencyKey`: required retry key. Reuse exactly for retries of the same payload.
- `workspaceId`: required graph version namespace.
- `source`: optional, one of `manual`, `pipeline`, `scheduled` (defaults to `manual`).
- `scanner.name`: required.
- `snapshot`: required Angular scanner payload (`schemaVersion: 1`).

## Success response

`200 OK` for succeeded ingest (new or deduplicated), `202 Accepted` while an ingest with the same key is still processing.

```json
{
  "status": "succeeded",
  "deduplicated": false,
  "scanRunId": "jh7d...",
  "graphVersionId": "k982...",
  "graphVersionNumber": 3,
  "attemptCount": 1
}
```

## Failure responses
- `400` invalid request payload
- `409` idempotency conflict (same key, different payload)
- `500` ingestion execution failure

Error body:

```json
{
  "errorCode": "INGESTION_REQUEST_FAILED",
  "message": "human-readable message"
}
```

## Idempotency and retries
- Same key + same payload + already succeeded:
  - returns existing success result without writing a new graph version.
- Same key + same payload + currently processing:
  - returns `status: "processing"` (`202` from HTTP endpoint).
- Same key + different payload:
  - request rejected with `409`.
- Failed run + retry with same key/payload:
  - safe retry; attempt count increments and ingestion restarts.
