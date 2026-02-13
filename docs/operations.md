# BetterDoc Operations

Last updated: 2026-02-13

## Package manager
- Standard package manager: `bun`

## Environment strategy (BD-002)

### Supported app environments
- `dev`
- `staging`
- `prod`

Set with `VITE_APP_ENV`.

### Required environment variables
- `VITE_APP_ENV`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_DEPLOYMENT_DEV`
- `VITE_CONVEX_DEPLOYMENT_STAGING`
- `VITE_CONVEX_DEPLOYMENT_PROD`
- `VITE_WORKOS_CLIENT_ID`
- `VITE_WORKOS_REDIRECT_URI`
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`

### Optional sync/deployment secrets
- `CONVEX_INGEST_URL` (required only for scanner ingestion/pipeline-free sync command)
- `CONVEX_INGEST_BEARER_TOKEN` (optional bearer auth for ingestion endpoint)
- `AZURE_DEVOPS_PAT` (optional for cloning private Azure repos with pipeline-free sync)

### Optional WorkOS cookie variables
- `WORKOS_COOKIE_NAME`
- `WORKOS_COOKIE_MAX_AGE`
- `WORKOS_COOKIE_DOMAIN`
- `WORKOS_COOKIE_SAME_SITE`

### Vercel metadata config points
- `VITE_VERCEL_ENV` (`development|preview|production`)
- `VITE_VERCEL_URL`
- `VITE_VERCEL_PROJECT_PRODUCTION_URL`

## Commands
- Install dependencies:
  - `bun install`
- Validate environment:
  - `bun run env:validate`
- Local dev server:
  - `bun run dev`
  - Vite dev port is pinned to `3000` (`strictPort=true` in `vite.config.ts`) so WorkOS callback URI stays stable.
- Quality checks:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`
  - `bun run build`
  - `bun run smoke:http -- --base-url https://<deployment-url>`
- Angular scanner (BD-010):
  - `bun run scan:angular -- --help`
  - `bun run scan:angular -- --workspace /path/to/angular-repo --output ./scan-output.json`
  - Full usage and snapshot schema: `docs/angular-scanner-cli.md`
- Manual Azure repo sync (pipeline-free):
  - `bun run sync:azure-repo -- --repo-url https://dev.azure.com/<org>/<project>/_git/<repo> --workspace-id <org>/<repo>`
  - Optional private repo token: set `AZURE_DEVOPS_PAT` (or pass `--pat <token>`)
  - If the repo contains multiple Angular workspaces, pass `--workspace-subpath <relative/path>`
  - `--ingest-url` accepts both `.convex.cloud` and `.convex.site` hosts; the command normalizes HTTP action calls to `.convex.site` and defaults path `/scanner/ingest` when missing
  - Uses `CONVEX_INGEST_URL` and reuses `scripts/ci/post-scan-ingestion.ts` retry/timeout policy
- Scanner snapshot ingestion (BD-011):
  - HTTP endpoint: `POST /scanner/ingest`
  - Convex action: `scanIngestion.ingestScannerSnapshot`
  - Latest successful run query: `scanIngestion.getLatestSuccessfulScanRun`
  - Contract reference: `docs/scanner-ingestion-api.md`

## Troubleshooting
- If you see browser errors mentioning `src/config/env.server.ts`, ensure the app is started with `bun run dev` and not a direct tool invocation that bypasses project scripts.
- If sign-in returns to `localhost:3000/api/auth/callback` and the page says connection refused, your app is not listening on `3000`. Start with `bun run dev` and free port `3000` if occupied by another process.

## Convex deployment command mapping
- Dev local workflow:
  - `bun run convex:dev`
- Staging deploy target:
  - `bun run convex:deploy:staging`
- Production deploy target:
  - `bun run convex:deploy:prod`

These commands source the deployment name from the corresponding environment variable.

## Scanner ingestion payload (BD-011)

Send scanner output to Convex with a caller-managed idempotency key:
(`CONVEX_INGEST_URL` example: `https://<deployment>.convex.site/scanner/ingest`)

```bash
curl -X POST "$CONVEX_INGEST_URL" \
  -H "content-type: application/json" \
  -d '{
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
    "snapshot": { "...": "scanner JSON output from BD-010" }
  }'
```

Retry rules:
- Use the same `idempotencyKey` and payload on retries for retry-safe behavior.
- Do not reuse an `idempotencyKey` with different payload content.
- Use `scanIngestion.getLatestSuccessfulScanRun` to verify successful ingest per workspace.

## Azure DevOps scan pipelines (BD-014)

Pipeline definitions:
- `.azure-pipelines/incremental-scan.yml`
  - Runs on PRs targeting `main` and merges/pushes to `main`.
  - Uses path filters to run only when Angular workspace inputs change:
    - `angular.json`, `workspace.json`, `project.json`, `apps/**`, `libs/**`, `projects/**`, `src/**`, `tsconfig.json`, `tsconfig.base.json`.
  - Posts with `INGEST_SOURCE=pipeline`.
- `.azure-pipelines/nightly-full-scan.yml`
  - Runs nightly full scan at `02:00 UTC` on `main` (`always: true`).
  - Posts with `INGEST_SOURCE=scheduled`.

Both pipelines execute:
1. Install Bun runtime.
2. Run `bun install --frozen-lockfile`.
3. Generate scanner output JSON with:
   - `bun run scan:angular -- --workspace "$(SCAN_WORKSPACE_PATH)" --output "$(Build.ArtifactStagingDirectory)/scan-snapshot.json"`
4. Post JSON snapshot to Convex via:
   - `bun run scripts/ci/post-scan-ingestion.ts`
5. Publish `scan-snapshot.json` as a build artifact.

Secret references:
- Azure variable group: `betterdoc-scan-ingestion-secrets`
- Required secret/variable: `CONVEX_INGEST_URL` (for example `https://<deployment>.convex.site/scanner/ingest`)
- Optional secret: `CONVEX_INGEST_BEARER_TOKEN` (added as `Authorization: Bearer <token>` when present)
- Non-secret workspace defaults:
  - `SCAN_WORKSPACE_PATH=$(Build.SourcesDirectory)`
  - `SCAN_WORKSPACE_ID=$(System.TeamProject)/$(Build.Repository.Name)`

Retry and timeout policy:
- Azure task policy:
  - `retryCountOnTaskFailure` on Bun install/dependency/ingestion steps.
  - `timeoutInMinutes` on scanner and ingestion steps, plus job-level timeout.
- Ingestion script policy (`scripts/ci/post-scan-ingestion.ts`):
  - Per-request timeout: `INGEST_TIMEOUT_MS`.
  - Retry attempts: `INGEST_MAX_ATTEMPTS`.
  - Exponential backoff bounds: `INGEST_INITIAL_BACKOFF_MS` and `INGEST_MAX_BACKOFF_MS`.
  - Retries transient failures only (network/timeout + HTTP `408`, `425`, `429`, `500`, `502`, `503`, `504`).

Pipeline-free alternative:
- If Azure Pipelines are not allowed by policy, use:
  - `bun run sync:azure-repo -- --repo-url <azure-clone-url> --workspace-id <workspace-id>`
- This command:
  1. Clones the repo locally (temporary folder by default)
  2. Runs `scan:angular`
  3. Posts the snapshot to Convex ingestion endpoint
  4. Cleans up the temporary clone unless `--keep-clone` is set

## Vercel deployment pipeline (BD-015)

Pipeline definition:
- `.azure-pipelines/vercel-deploy.yml`

Stages:
1. `quality_checks` (runs for PR and `main`):
   - `bun install --frozen-lockfile`
   - `bun run lint`
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`
2. `deploy_preview` (PR builds only):
   - Deploys preview with `scripts/ci/vercel-deploy.sh preview`
   - Runs smoke checks via `node scripts/ci/run-smoke-tests.mjs --base-url <preview-url>`
3. `deploy_staging` (`main` branch, non-PR):
   - Deploys staging with `scripts/ci/vercel-deploy.sh staging`
   - Runs smoke checks against the staging deployment URL
4. `deploy_production` (manual promotion):
   - Runs only when pipeline variable `PROMOTE_TO_PROD=true`
   - Deploys with `scripts/ci/vercel-deploy.sh production`
   - Runs smoke checks against production URL

Secrets and variables:
- Azure variable group: `betterdoc-vercel-secrets`
- Required:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Optional:
  - `VERCEL_STAGING_DOMAIN` (alias set after staging deploy)
  - `VERCEL_PRODUCTION_DOMAIN` (alias set after production deploy)
- Promotion control:
  - `PROMOTE_TO_PROD` (defaults to `false`)

Rollback path:
1. Identify last known good deployment URL from pipeline artifacts (`vercel-production-url`).
2. Run:
   - `npx --yes vercel@latest rollback <deployment-url-or-id> --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"`
3. Re-run smoke checks:
   - `bun run smoke:http -- --base-url https://<rolled-back-url>`
4. Record incident + rollback context in `docs/change-log.md`.

## Watchlist notifications operations (BD-016)

Watchlist capabilities:
- Subscribe/unsubscribe from component pages (`/explorer/$workspaceId/component/$componentId`) and dashboard watchlist controls.
- In-app notifications are logged in Convex on tip publish/update fanout for linked components.
- Notification delivery is currently `in_app` and persisted with delivery status + read state.

Operational checks:
1. Subscribe to a component from its detail page.
2. Publish a tip linked to that component from `/dashboard`.
3. Verify:
   - Notification row exists in dashboard "Watch Notifications".
   - Notification status shows `delivered`.
   - Mark-read actions update unread/read state.

## Hardening artifacts (BD-017)

- Launch runbook: `docs/launch-runbook.md`
- Backup/restore validation drill: `docs/backup-restore-validation.md`

## Auth routes (BD-003)
- `GET /login` -> redirect to WorkOS AuthKit sign-in URL.
- `GET /api/auth/callback` -> callback exchange and session cookie set.
- `GET /dashboard` -> protected page (redirects to sign-in when unauthenticated).
- `GET /logout` -> clear session and redirect through WorkOS logout.

## Local verification
1. Run `bun run dev`.
2. Open `http://localhost:3000/` and click `Sign in with WorkOS`.
3. Confirm browser redirects to WorkOS and then back to `/api/auth/callback`.
4. Confirm `/dashboard` is accessible only after successful sign-in.
5. Confirm `/logout` clears session and returns to signed-out state.
