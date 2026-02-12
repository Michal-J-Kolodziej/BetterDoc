# BetterDoc Security And Access

Last updated: 2026-02-12

## Current state
- WorkOS AuthKit SSO is implemented for login, callback, logout, and protected-route enforcement.
- Session handling is performed server-side via `authkitMiddleware()` in `src/start.ts`.
- Middleware redirect override in `src/start.ts` is sourced from `VITE_WORKOS_REDIRECT_URI` (public env) to avoid loading `src/config/env.server.ts` in client runtime.

## WorkOS configuration points
- Public WorkOS settings (client-visible):
  - `VITE_WORKOS_CLIENT_ID`
  - `VITE_WORKOS_REDIRECT_URI`
- Server-side AuthKit settings:
  - `WORKOS_API_KEY`
  - `WORKOS_CLIENT_ID`
  - `WORKOS_REDIRECT_URI`
  - `WORKOS_COOKIE_PASSWORD`
  - `WORKOS_COOKIE_NAME` (optional)
  - `WORKOS_COOKIE_MAX_AGE` (optional)
  - `WORKOS_COOKIE_DOMAIN` (optional)
  - `WORKOS_COOKIE_SAME_SITE` (optional)
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
- In `staging`/`prod`, `WORKOS_REDIRECT_URI` must use `https://`.
- `WORKOS_COOKIE_PASSWORD` must be at least 32 characters.
- `WORKOS_CLIENT_ID` must match `VITE_WORKOS_CLIENT_ID`.
- `WORKOS_REDIRECT_URI` must match `VITE_WORKOS_REDIRECT_URI`.
- In `staging`, if set, `VITE_VERCEL_ENV` must be `preview`.
- In `prod`, if set, `VITE_VERCEL_ENV` must be `production`.
- `WORKOS_API_KEY` is required in all environments.

## Auth flow summary
1. User opens `/login`.
2. Server handler redirects to WorkOS AuthKit authorization URL.
3. WorkOS redirects to `/api/auth/callback` with an authorization code.
4. `handleCallbackRoute()` validates the code and sets encrypted session cookie headers.
5. Protected route `/dashboard` checks `context.auth()`:
   - No user: redirect to WorkOS sign-in.
   - User exists: render protected page.
6. `/logout` terminates WorkOS session and clears local cookie.

## Cookie security
- Cookies are HTTP-only (managed by AuthKit session storage).
- `SameSite` defaults to `lax`, override via `WORKOS_COOKIE_SAME_SITE`.
- `Secure` is derived from `WORKOS_REDIRECT_URI` protocol:
  - `https://` -> `Secure=true`
  - `http://` -> `Secure=false` (dev only)
