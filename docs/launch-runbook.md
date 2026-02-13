# BetterDoc Launch Runbook (BD-017)

Last updated: 2026-02-13

## Scope
- Production launch and rollback process for BetterDoc web + Convex backend.
- Covers deployment via Azure DevOps + Vercel pipeline (`.azure-pipelines/vercel-deploy.yml`).

## Prerequisites
- Azure pipeline exists and is green for:
  - `quality_checks`
  - `deploy_staging`
- Variable groups configured:
  - `betterdoc-vercel-secrets`
  - `betterdoc-scan-ingestion-secrets`
- Required Vercel secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Convex deployment targets configured in environment:
  - `VITE_CONVEX_DEPLOYMENT_DEV`
  - `VITE_CONVEX_DEPLOYMENT_STAGING`
  - `VITE_CONVEX_DEPLOYMENT_PROD`

## Release flow
1. Validate PR preview:
   - Confirm preview stage produced a URL artifact (`vercel-preview-url`).
   - Verify smoke checks passed.
2. Validate staging:
   - Merge to `main` and wait for `deploy_staging`.
   - Verify smoke checks passed on staging URL artifact (`vercel-staging-url`).
3. Promote production:
   - Re-run pipeline on `main` with variable `PROMOTE_TO_PROD=true`.
   - Confirm `deploy_production` completes with smoke checks.
4. Post-release verification:
   - Open `/`, `/dashboard`, `/explorer`, and one component detail URL.
   - Publish a component-linked tip and verify watcher notifications appear.

## Rollback procedure
1. Determine last known good production deployment URL/ID:
   - Pipeline artifact `vercel-production-url`
   - Or `vercel list` output.
2. Execute rollback:
   - `npx --yes vercel@latest rollback <deployment-url-or-id> --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"`
3. Re-run smoke checks:
   - `bun run smoke:http -- --base-url https://<rolled-back-url>`
4. Announce rollback in incident channel and record context in `docs/change-log.md`.

## Smoke check commands
- Local smoke against deployed URL:
  - `bun run smoke:http -- --base-url https://<deployment-url>`
- Pipeline smoke script:
  - `node scripts/ci/run-smoke-tests.mjs --base-url https://<deployment-url>`

## Launch checklist
- [ ] `quality_checks` passed on release commit.
- [ ] Staging deployment and smoke checks passed.
- [ ] Production promotion run completed (`PROMOTE_TO_PROD=true`).
- [ ] Auth redirects and protected routes verified.
- [ ] Component watchlist notification flow verified.
- [ ] Rollback command and prior deployment ID confirmed.
