# BetterDoc Codebase Reference

Last updated: 2026-02-12

## App Foundation (BD-001)

### Runtime stack
- Framework: TanStack Start (`@tanstack/react-start`)
- Router: TanStack Router file routes (`src/routes` + generated `src/routeTree.gen.ts`)
- UI: React 19
- Backend client: Convex React client (`convex/react`)

### Entry points and routing
- Router entry: `src/router.tsx`
  - Exports `getRouter()` for TanStack Start runtime.
  - Builds router with `routeTree` from generated `src/routeTree.gen.ts`.
- Start entry: `src/start.ts`
  - Registers `authkitMiddleware()` for per-request WorkOS session validation/refresh.
  - Uses `VITE_WORKOS_REDIRECT_URI` from `import.meta.env` for middleware redirect override so browser bundles do not evaluate server-only env parsing.
- Root route: `src/routes/__root.tsx`
  - Owns the HTML document shell and global providers.
  - Mounts `AuthKitProvider` for client auth state and `ConvexAppProvider` for Convex hooks.
- Index route: `src/routes/index.tsx`
  - Public landing page with links into auth flow and protected dashboard.

### Convex integration
- Convex client provider: `src/lib/convex-client.tsx`
  - Initializes `ConvexReactClient` using validated `VITE_CONVEX_URL`.
- Convex function: `convex/health.ts`
  - Exposes `getStatus` query for initial end-to-end health check.
- Convex RBAC/audit module: `convex/accessControl.ts`
  - Public queries: `getAccessProfile`, `listTips`, `getTipForEditor`, `listTipRevisions`, `listAuditEvents`.
  - Public mutations: `bootstrapFirstAdmin`, `assignRole`, `saveTipDraft`, `publishTip`, `deprecateTip`, `configureIntegration`.
  - Enforces capability checks server-side for privileged operations and audit reads.
- RBAC constants/validators: `convex/rbac.ts`
- Convex schema: `convex/schema.ts`
  - Tables: `memberships`, `tips`, `tipRevisions`, `integrationConfigs`, `auditEvents`.
- Typed API stubs:
  - `convex/_generated/api.ts`
  - `convex/_generated/server.ts`
  - `convex/_generated/dataModel.ts`

## Quality gates
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

All four pass with valid environment variables set.

## Authentication (BD-003)

### Runtime package
- `@workos/authkit-tanstack-react-start`

### Auth routes
- Login redirect: `src/routes/login.tsx`
  - `GET /login` server handler generates WorkOS sign-in URL and redirects.
- Callback: `src/routes/api/auth/callback.tsx`
  - `GET /api/auth/callback` uses `handleCallbackRoute()` to exchange code and set session.
- Logout: `src/routes/logout.tsx`
  - `GET /logout` clears session cookie and redirects to WorkOS logout URL.

### Protected route
- `src/routes/dashboard.tsx`
  - `GET /dashboard` server handler checks `context.auth()` from middleware.
  - Unauthenticated requests redirect to WorkOS sign-in.
  - Authenticated requests call `next()` and render dashboard component with role-aware guards.

## Authorization + Audit (BD-004, BD-005)

### Role-to-capability matrix
- `Reader`: `tips.read`
- `Contributor`: `tips.read`, `tips.create`
- `Reviewer`: `tips.read`, `tips.create`, `tips.publish`, `tips.deprecate`, `audit.read`
- `Admin`: Reviewer capabilities + `roles.assign`, `integration.configure`

### Enforcement points
- Server-side RBAC guard helpers:
  - `convex/rbac.ts`: `hasPermission()`, matrix constants, validators.
  - `convex/accessControl.ts`: `requirePermission()` checks inside guarded queries/mutations.
- Frontend UI guards:
  - `src/lib/rbac.ts`: shared role/capability map used by route components.
  - `src/routes/dashboard.tsx`: disables/hides privileged controls unless role has required capability.

### Immutable audit events
- Privileged actions that always append an audit row:
  - `tip.publish`
  - `tip.deprecate`
  - `role.assign`
  - `integration.configure`
- Audit writes are append-only via `insertAuditEvent()` in `convex/accessControl.ts`.
- No mutation is exposed to update/delete records in `auditEvents`.

## Tips Core + Editor (BD-006, BD-007)

### Tip data model
- `convex/schema.ts`
  - `tips` stores the latest draft/published state with structured content:
    - `symptom`, `rootCause`, `fix`, `prevention`, `tags`, `references`
    - revision cursor: `currentRevision`
    - ownership/timestamps: `createdByWorkosUserId`, `createdAt`, `updatedByWorkosUserId`, `updatedAt`
  - `tipRevisions` stores immutable snapshots for each draft save:
    - link: `tipId`
    - sequence: `revisionNumber`
    - full content snapshot + status + editor + timestamp

### Draft save + revision workflow
- `convex/tipDraft.ts`
  - Normalizes and validates draft content server-side (required structured fields, length limits, tag/reference normalization).
  - Generates metadata (`slug`, `title`) from the symptom field.
- `convex/accessControl.ts`
  - `saveTipDraft` creates or updates a draft tip and always inserts a `tipRevisions` row.
  - `listTipRevisions` returns newest-first revision metadata for editor history.
  - `getTipForEditor` reads structured tip content for edit workflows.
  - `publishTip` and `deprecateTip` now enforce organization-scoped tip access.

### Editor UI
- `src/routes/dashboard.tsx`
  - Adds a structured editor section with fields:
    - `symptom`
    - `root cause`
    - `fix`
    - `prevention`
    - `tags`
    - `references`
  - Uses `saveTipDraft` for draft saves and shows revision history from `listTipRevisions`.
  - Includes an explicit load action to populate the editor from an existing tip.
- `src/lib/tip-editor.ts`
  - Client-side field validation and payload shaping for tags/references before mutation calls.
