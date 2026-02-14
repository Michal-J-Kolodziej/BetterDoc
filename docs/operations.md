# BetterDoc Operations

Last updated: 2026-02-14

## Package Manager
- `bun`

## Runtime Environments
Set `VITE_APP_ENV` to one of:
- `dev`
- `staging`
- `prod`

## Required Environment Variables
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

Optional:
- `WORKOS_COOKIE_NAME`
- `WORKOS_COOKIE_MAX_AGE`
- `WORKOS_COOKIE_DOMAIN`
- `WORKOS_COOKIE_SAME_SITE`
- `VITE_VERCEL_ENV`
- `VITE_VERCEL_URL`
- `VITE_VERCEL_PROJECT_PRODUCTION_URL`

## Local Commands
- Install deps: `bun install`
- Validate env: `bun run env:validate`
- Start dev server: `bun run dev`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Tests: `bun run test`
- Build: `bun run build`
- Smoke test deployed URL: `bun run smoke:http -- --base-url https://<url>`

## Convex Commands
- Generate API/types: `bun run convex:codegen`
- Dev deployment: `bun run convex:dev`
- Deploy staging: `bun run convex:deploy:staging`
- Deploy production: `bun run convex:deploy:prod`

## Deployment
Current release workflow is manual and Vercel-based.

Typical sequence:
1. Run local quality gates (`lint`, `typecheck`, `test`, `build`).
2. Push branch and deploy with Vercel CLI or Vercel UI.
3. Run smoke checks against the deployed URL.

## Removed Operational Surfaces
The following are intentionally not part of V2 operations:
- Azure pipeline YAML workflows under `.azure-pipelines`
- Angular scanner CLI and ingestion commands
- Manual Azure repo sync scripts

## Auth Verification (Quick Check)
1. `bun run dev`
2. Open `http://localhost:3000/`
3. Login via WorkOS (`/login`)
4. Confirm access to `/dashboard`
5. Logout via `/logout` and confirm session is cleared
