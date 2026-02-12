# BetterDoc Operations

Last updated: 2026-02-12

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
- Angular scanner (BD-010):
  - `bun run scan:angular -- --help`
  - `bun run scan:angular -- --workspace /path/to/angular-repo --output ./scan-output.json`
  - Full usage and snapshot schema: `docs/angular-scanner-cli.md`
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

```bash
curl -X POST "$VITE_CONVEX_URL/scanner/ingest" \
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
