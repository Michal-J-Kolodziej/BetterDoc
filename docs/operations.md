# BetterDoc Operations

Last updated: 2026-02-11

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
- Quality checks:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`
  - `bun run build`

## Convex deployment command mapping
- Dev local workflow:
  - `bun run convex:dev`
- Staging deploy target:
  - `bun run convex:deploy:staging`
- Production deploy target:
  - `bun run convex:deploy:prod`

These commands source the deployment name from the corresponding environment variable.

## Auth routes (BD-003)
- `GET /login` -> redirect to WorkOS AuthKit sign-in URL.
- `GET /api/auth/callback` -> callback exchange and session cookie set.
- `GET /dashboard` -> protected page (redirects to sign-in when unauthenticated).
- `GET /logout` -> clear session and redirect through WorkOS logout.

## Local verification
1. Run `bun run dev`.
2. Open `http://localhost:5173/` and click `Sign in with WorkOS`.
3. Confirm browser redirects to WorkOS and then back to `/api/auth/callback`.
4. Confirm `/dashboard` is accessible only after successful sign-in.
5. Confirm `/logout` clears session and returns to signed-out state.
