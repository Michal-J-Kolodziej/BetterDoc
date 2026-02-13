# BetterDoc Security And Access

Last updated: 2026-02-13

## Current state
- WorkOS AuthKit SSO is implemented for login, callback, logout, and protected-route enforcement.
- Session handling is performed server-side via `authkitMiddleware()` in `src/start.ts`.
- Middleware redirect override in `src/start.ts` is sourced from `VITE_WORKOS_REDIRECT_URI` (public env) to avoid loading `src/config/env.server.ts` in client runtime.
- RBAC is implemented with app roles (`Reader`, `Contributor`, `Reviewer`, `Admin`) and capability checks in Convex queries/mutations plus frontend guards.
- Privileged actions write immutable audit entries to `auditEvents`.
- Component watchlist subscriptions and notification inbox reads are permission-gated with `tips.read` and tenant-scoped by organization.

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
   - User exists: render protected page and fetch RBAC access profile from Convex.
6. `/logout` terminates WorkOS session and clears local cookie.

## RBAC model (BD-004)

Role-capability matrix:
- `Reader`: `tips.read`
- `Contributor`: `tips.read`, `tips.create`
- `Reviewer`: `tips.read`, `tips.create`, `tips.publish`, `tips.deprecate`, `audit.read`
- `Admin`: Reviewer capabilities + `roles.assign`, `integration.configure`

Convex enforcement:
- Role source: `memberships` table keyed by `workosUserId`.
- Guard helpers:
  - `convex/rbac.ts`: matrix and `hasPermission()`.
  - `convex/accessControl.ts`: `requirePermission()` used in privileged queries/mutations.
- Query guards:
  - `listAuditEvents` requires `audit.read`.
  - `listTips` requires `tips.read` and additionally restricts `Reader` to published tips only.
  - `getTipForEditor` requires `tips.create` (draft authoring access).
  - `listTipRevisions` requires `tips.create` (draft revision history access).
  - `getComponentWatchStatus`, `listMyComponentWatchSubscriptions`, and `listWatchNotifications` require `tips.read`.
- Mutation guards:
  - `assignRole` requires `roles.assign`.
  - `saveTipDraft` requires `tips.create` and additionally enforces reviewer permission (`tips.publish`) when editing an `in_review` tip back to `draft`.
  - `submitTipForReview` requires `tips.create`.
  - `returnTipToDraft` requires `tips.publish`.
  - `publishTip` requires `tips.publish` and only allows `in_review -> published`.
  - `deprecateTip` requires `tips.deprecate` and only allows `published -> deprecated`.
  - `configureIntegration` requires `integration.configure`.
  - `subscribeToComponentWatchlist`, `unsubscribeFromComponentWatchlist`, `markWatchNotificationRead`, and `markAllWatchNotificationsRead` require `tips.read`.
  - Tip mutations enforce organization-scoped access via `assertTipOrganizationAccess()` before modifying an existing tip.
  - Workflow transitions are server-validated via `assertStatusTransition()` in `convex/accessControl.ts` (`draft -> in_review -> published -> deprecated`, plus `in_review -> draft` for reviewer feedback).

Frontend guards:
- Dashboard UI (`src/routes/dashboard.tsx`) uses `src/lib/rbac.ts` to disable privileged controls when the signed-in role lacks capability.

## Watchlist notification access (BD-016)

- Subscription scope:
  - Watch subscriptions are stored per component identity (`workspaceId`, `projectName`, `componentName`, `componentFilePath`) and filtered by `organizationId` when present.
- Notification scope:
  - `watchNotifications` rows are written per watcher and organization context.
  - Users can only read/update notification rows where `watcherWorkosUserId` matches the current actor.
- Delivery model:
  - Notification delivery channel is currently `in_app` only.
  - Delivery state (`delivered`/`failed`) and read state (`isRead`, `readAt`) are persisted for auditability and troubleshooting.

## Audit model (BD-005)

Privileged actions that append immutable audit rows:
- `tip.publish`
- `tip.deprecate`
- `role.assign`
- `integration.configure`

Audit record shape (`auditEvents`):
- `actorWorkosUserId`
- `actorRole`
- `organizationId`
- `action`
- `targetType`
- `targetId`
- `summary`
- `createdAt`

Immutability constraints:
- Audit rows are only written via `insertAuditEvent()` in `convex/accessControl.ts`.
- No public mutation exists to patch or delete `auditEvents`.

## Cookie security
- Cookies are HTTP-only (managed by AuthKit session storage).
- `SameSite` defaults to `lax`, override via `WORKOS_COOKIE_SAME_SITE`.
- `Secure` is derived from `WORKOS_REDIRECT_URI` protocol:
  - `https://` -> `Secure=true`
  - `http://` -> `Secure=false` (dev only)
