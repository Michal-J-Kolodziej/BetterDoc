# BetterDoc Security And Access

Last updated: 2026-02-11

## Current state
- WorkOS SSO flow is not implemented yet (planned in BD-003).
- This iteration establishes environment and config guardrails for WorkOS usage.

## WorkOS configuration points
- Public WorkOS settings (client-visible):
  - `VITE_WORKOS_CLIENT_ID`
  - `VITE_WORKOS_REDIRECT_URI`
- Server secret:
  - `WORKOS_API_KEY`
- Config modules:
  - Client config: `src/config/platform.ts` (`workosClientConfig`)
  - Server config: `src/config/workos.server.ts` (`workosServerConfig`)

## Environment validation controls
- Validation logic: `src/config/env.shared.ts`
- Server validation entry: `src/config/env.server.ts`
- Validation command: `bun run env:validate`

Enforced rules:
- `VITE_APP_ENV` must be one of `dev`, `staging`, `prod`.
- In `staging`/`prod`, `VITE_WORKOS_REDIRECT_URI` must use `https://`.
- In `staging`, if set, `VITE_VERCEL_ENV` must be `preview`.
- In `prod`, if set, `VITE_VERCEL_ENV` must be `production`.
- `WORKOS_API_KEY` is required in `staging` and `prod`.
