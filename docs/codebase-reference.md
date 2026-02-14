# BetterDoc Codebase Reference

Last updated: 2026-02-13

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
  - Public landing page with links into auth flow, protected dashboard, and component explorer.

### UI Styling System (Tailwind v4)
- Tailwind runtime:
  - `tailwindcss` + `@tailwindcss/vite` configured in `vite.config.ts`
- Global style entry:
  - `src/styles.css` now imports Tailwind and layered style modules:
    - `src/styles/tokens.css`
    - `src/styles/base.css`
    - `src/styles/components.css`
    - `src/styles/motion.css`
- Theme system:
  - Uses dark ink/cyan/amber tokens and font tokens (`Space Grotesk`, `Manrope`, `JetBrains Mono`) via `@theme`.
  - Applies minimal-border, tonal-depth panel styling (`app-panel`, `app-card`) and utility-first control classes (`app-input`, `app-select`, `app-textarea`, `app-btn*`).
- Accessibility and interaction:
  - Centralized focus-visible treatment, reduced-motion fallback, and consistent input/button disabled behavior in layered base/components CSS.

### Shared UI Primitive Layer
- `src/components/ui/AppShell.tsx`
- `src/components/ui/SidebarRail.tsx`
- `src/components/ui/PageTopbar.tsx`
- `src/components/ui/Tabs.tsx`
- `src/components/ui/Panel.tsx`
- `src/components/ui/StatusChip.tsx`
- `src/components/ui/MetricStrip.tsx`
- `src/components/ui/EntityList.tsx`
- `src/lib/classnames.ts`

### Route Structure Refresh (Tabbed dashboard + unified explorer shell)
- `src/routes/dashboard.tsx`
  - Uses `validateSearch` with URL-synced tab selection contract:
    - `tab` values: `overview`, `tip-studio`, `workflow`, `search`, `watchlist`, `audit`
    - missing/invalid values fall back to `overview`
  - Refactored into shell primitives + feature panels while preserving all existing RBAC/query/mutation behavior.
- Dashboard feature components:
  - `src/features/dashboard/DashboardTabs.tsx`
  - `src/features/dashboard/types.ts`
  - `src/features/dashboard/panels/OverviewPanel.tsx`
  - `src/features/dashboard/panels/TipStudioPanel.tsx`
  - `src/features/dashboard/panels/WorkflowPanel.tsx`
  - `src/features/dashboard/panels/SearchPanel.tsx`
  - `src/features/dashboard/panels/WatchlistPanel.tsx`
  - `src/features/dashboard/panels/AuditPanel.tsx`
- Explorer family:
  - `src/features/explorer/ExplorerLayout.tsx`
  - `src/routes/explorer.tsx`
  - `src/routes/explorer.$workspaceId.tsx`
  - `src/routes/explorer.$workspaceId.project.$projectName.tsx`
  - `src/routes/explorer.$workspaceId.lib.$libraryName.tsx`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - All explorer views now share a common shell composition (sidebar rail + topbar + semantic data panels).
- `src/routes/index.tsx`
  - Updated to use the same shell primitives and metric/panel structure for consistent UX with dashboard and explorer.

### Convex integration
- Convex client provider: `src/lib/convex-client.tsx`
  - Initializes `ConvexReactClient` using validated `VITE_CONVEX_URL`.
- Convex function: `convex/health.ts`
  - Exposes `getStatus` query for initial end-to-end health check.
- Convex scan ingestion modules:
  - `convex/scanIngestion.ts`
    - Public action: `ingestScannerSnapshot`
    - Public query: `getLatestSuccessfulScanRun`
  - `convex/scanIngestionInternal.ts`
    - Internal mutations: `acquireScanRunForIngestion`, `finalizeScanRunSuccess`, `markScanRunFailed`
  - `convex/http.ts`
    - HTTP endpoint: `POST /scanner/ingest` (bridges JSON payloads to `ingestScannerSnapshot`)
- Convex RBAC/audit module: `convex/accessControl.ts`
  - Public queries: `getAccessProfile`, `listTips`, `listComponentExplorerWorkspaces`, `getComponentExplorerWorkspace`, `getComponentExplorerProject`, `getComponentExplorerComponent`, `getTipForEditor`, `listTipRevisions`, `listTipComponentLinksForEditor`, `getComponentWatchStatus`, `listMyComponentWatchSubscriptions`, `listWatchNotifications`, `listAuditEvents`.
  - Public mutations: `bootstrapFirstAdmin`, `assignRole`, `saveTipDraft`, `submitTipForReview`, `returnTipToDraft`, `publishTip`, `deprecateTip`, `subscribeToComponentWatchlist`, `unsubscribeFromComponentWatchlist`, `markWatchNotificationRead`, `markAllWatchNotificationsRead`, `configureIntegration`.
  - Enforces capability checks server-side for privileged operations and audit reads.
- RBAC constants/validators: `convex/rbac.ts`
- Convex schema: `convex/schema.ts`
  - Tables: `memberships`, `tips`, `tipRevisions`, `tipTagFacets`, `tipComponentLinks`, `componentWatchSubscriptions`, `watchNotifications`, `scanRuns`, `componentGraphHeads`, `componentGraphVersions`, `componentGraphProjects`, `componentGraphComponents`, `componentGraphDependencies`, `integrationConfigs`, `auditEvents`.
- Typed API stubs:
  - `convex/_generated/api.ts`
  - `convex/_generated/server.ts`
  - `convex/_generated/dataModel.ts`

## Quality gates
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run smoke:http -- --base-url <deployed-url-or-local-url>`

All listed checks pass with valid environment variables set.

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
  - Uses `ssr: false` because dashboard relies on Convex React hooks (`useQuery`, `useMutation`) and `ConvexProvider` is mounted client-side.
  - Validates optional `tab` search param and normalizes invalid values to `overview`.
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

## Tips Core + Editor + Workflow + Search (BD-006, BD-007, BD-008, BD-009)

### Tip data model
- `convex/schema.ts`
  - `tips` stores latest tip state with structured content + searchable facets:
    - content: `symptom`, `rootCause`, `fix`, `prevention`, `tags`, `references`
    - scope facets: `project`, `library`, `component`
    - denormalized search field: `searchText`
    - lifecycle status: `draft`, `in_review`, `published`, `deprecated`
    - revision cursor: `currentRevision`
    - ownership/timestamps: `createdByWorkosUserId`, `createdAt`, `updatedByWorkosUserId`, `updatedAt`
  - `tipRevisions` stores immutable snapshots for each draft save or status transition:
    - link: `tipId`
    - sequence: `revisionNumber`
    - full content/search snapshot + status + editor + timestamp
  - `tipTagFacets` stores normalized (`lowercase`) tag-to-tip rows for indexed tag filters.
  - `tipComponentLinks` stores many-to-many tip-to-component relationships keyed by `workspaceId + projectName + componentName + componentFilePath`, scoped by tip organization.

### Indexed querying
- `convex/schema.ts` indexes:
  - `tips`: organization-aware compound indexes (`by_org_status_updated_at`, `by_org_project_updated_at`, `by_org_library_updated_at`, `by_org_component_updated_at`) plus `search_text` search index with filter fields.
  - `tipTagFacets`: tag indexes (`by_org_tag_*`, `by_tag_*`) for fast tag-first candidate lookups.
- `convex/accessControl.ts` `listTips` query:
  - accepts combinable filters (`searchText`, `project`, `library`, `component`, `tag`, `status`)
  - chooses an indexed query strategy first, then applies final in-memory predicate checks and returns newest-first limited results.
  - enforces reader visibility to published tips only.

### Draft save + revision workflow
- `convex/tipDraft.ts`
  - Normalizes and validates draft content server-side (required structured fields, optional project/library/component facets, length limits, tag/reference normalization).
  - Generates metadata (`slug`, `title`) from the symptom field.
  - Builds denormalized `searchText` content used by the `tips.search_text` index.
- `convex/accessControl.ts`
  - `saveTipDraft` creates or updates draft content, enforces valid transition to `draft` (including reviewer requirement for `in_review -> draft` edits), updates tag facets, optionally replaces tip-component links, and appends a revision snapshot.
  - `submitTipForReview` transitions `draft -> in_review`.
  - `returnTipToDraft` transitions `in_review -> draft` (review feedback loop).
  - `publishTip` transitions `in_review -> published` and writes an audit event.
  - `deprecateTip` transitions `published -> deprecated` and writes an audit event.
  - Invalid transitions are rejected server-side by `assertStatusTransition()`.
  - `listTipRevisions` returns newest-first revision metadata for editor history.
  - `getTipForEditor` reads structured tip content for edit workflows.
  - Existing-tip writes and transitions enforce organization-scoped access.

### Editor UI
- Dashboard orchestration route: `src/routes/dashboard.tsx`
  - Owns hook wiring, permissions, mutation/query orchestration, and URL-synced tab state.
- Tab panels:
  - `src/features/dashboard/panels/TipStudioPanel.tsx`
    - Structured editor fields:
      - `symptom`
      - `root cause`
      - `fix`
      - `prevention`
      - `project` (optional)
      - `library` (optional)
      - `component` (optional)
      - `tags`
      - `references`
    - Uses `saveTipDraft` for draft saves and shows revision history from `listTipRevisions`.
    - Provides component-linking controls (workspace -> project/library -> component) backed by latest scanned graph queries and persists links via `saveTipDraft.componentLinks`.
  - `src/features/dashboard/panels/WorkflowPanel.tsx`
    - Includes lifecycle controls for submit/review return/publish/deprecate with status-aware button gating.
    - Includes guarded privileged actions (bootstrap first admin, role assignment, integration configure).
  - `src/features/dashboard/panels/SearchPanel.tsx`
    - Renders indexed search/filter UI with empty, validation-error, and permission-denied states.
  - `src/features/dashboard/panels/WatchlistPanel.tsx`
    - Renders watchlist management and notification inbox actions.
  - `src/features/dashboard/panels/AuditPanel.tsx`
    - Renders immutable audit event timeline table.
- `src/lib/tip-editor.ts`
  - Client-side validation and payload shaping for core fields, optional facets, tags, and references before mutation calls.

## Angular Scanner CLI (BD-010)

### Implementation
- Scanner library: `src/lib/angular-scanner.ts`
  - Loads Angular workspace config (`angular.json` or `workspace.json`) and project metadata.
  - Supports string project references by resolving `project.json` files.
  - Scans TypeScript sources to identify `@Component` classes and extract:
    - component class name
    - selector
    - standalone flag
    - project ownership
    - component file path
    - component-level internal dependencies
  - Builds project dependency edges from imports using:
    - relative file imports mapped to project roots
    - TS path alias mapping from `tsconfig.base.json` / `tsconfig.json`
  - Emits deterministic snapshot objects with sorted projects/libs/components/dependencies.
- CLI entrypoint: `scripts/angular-scanner.ts`
  - Command: `bun run scan:angular -- --workspace <path> --output <file>`
  - Defaults workspace to current directory and output to stdout.
  - Reports structured scanner errors with explicit error codes for missing/invalid workspace and path issues.

### Test coverage
- `src/lib/angular-scanner.test.ts`
  - Verifies extraction of projects, libraries, components, dependencies, and file paths.
  - Verifies deterministic snapshot output across repeated scans.
  - Verifies `project.json` project reference loading.
  - Verifies explicit parse/missing-workspace errors.

## Scanner Snapshot Ingestion (BD-011)

### Ingestion contract + endpoint
- Public Convex action: `convex/scanIngestion.ts` -> `ingestScannerSnapshot`
- HTTP endpoint: `POST /scanner/ingest` in `convex/http.ts`
- Full payload/response contract doc: `docs/scanner-ingestion-api.md`
- Request payload contract:
  - `idempotencyKey`: caller-generated unique key for a scan attempt (reused on retries)
  - `workspaceId`: stable workspace/repository identifier used for graph version sequencing
  - `source`: `manual | pipeline | scheduled` (optional, defaults to `manual`)
  - `scanner`: `{ name, version? }`
  - `metadata?`: `{ branch?, commitSha?, runId? }`
  - `snapshot`: Angular scanner JSON payload (`schemaVersion: 1`, `projects`, `libs`, `components`, `dependencies`)

### Persistence model
- `scanRuns`:
  - stores idempotency key, payload hash, lifecycle status (`processing`, `failed`, `succeeded`), attempt count, and summary counts.
  - records failure metadata (`errorCode`, `errorMessage`) for retry diagnostics.
  - links successful runs to a graph version (`graphVersionId`, `graphVersionNumber`).
- `componentGraphHeads`:
  - one row per `workspaceId`, tracks latest assigned graph version.
- `componentGraphVersions`:
  - immutable version metadata per successful ingest.
- `componentGraphProjects`, `componentGraphComponents`, `componentGraphDependencies`:
  - immutable per-version graph rows used by downstream explorer/linking work.

### Idempotency + retry behavior
- Duplicate call with same `idempotencyKey` + same payload hash:
  - returns existing successful result without creating new rows.
- Duplicate call with same key while first attempt is still processing:
  - returns `processing` status and no duplicate writes.
- Reusing a key with a different payload:
  - request is rejected (`Idempotency key reuse detected with a different scanner snapshot payload.`).
- Failed run retry with same key + same payload:
  - run transitions back to `processing`, increments `attemptCount`, and retries safely.

### Query surface
- `getLatestSuccessfulScanRun(workspaceId)` returns the latest succeeded run metadata + linked graph version info for operational checks and downstream UI loading.

## Azure DevOps Scan Pipelines (BD-014)

### Pipeline assets
- `.azure-pipelines/incremental-scan.yml`
  - PR + merge trigger pipeline for incremental scan ingestion.
- `.azure-pipelines/nightly-full-scan.yml`
  - Scheduled nightly full scan ingestion pipeline.
- `scripts/ci/post-scan-ingestion.ts`
  - Reusable ingestion client used by both pipelines.
  - Reads scanner JSON snapshot from disk, attaches Azure run metadata, and posts to `POST /scanner/ingest`.
  - Supports configurable timeout/retry/backoff via environment variables and optional bearer auth header.
- `scripts/manual-sync-azure-repo.ts`
  - Pipeline-free alternative for policy-restricted environments.
  - Clones Azure repo locally, runs scanner, and ingests snapshot via existing ingestion script.
  - Supports private repos via `AZURE_DEVOPS_PAT` / `--pat`, branch override, optional clone retention, explicit workspace ID mapping, and `--workspace-subpath` for monorepos with multiple Angular workspaces.
  - Normalizes Convex ingest host from `.convex.cloud` to `.convex.site` for HTTP action routing and defaults missing ingest path to `/scanner/ingest`.

## Vercel Deployment Pipeline (BD-015)

### Pipeline assets
- `.azure-pipelines/vercel-deploy.yml`
  - Multi-stage Azure pipeline covering:
    - PR preview deployment + smoke checks
    - `main` staging deployment + smoke checks
    - manual production promotion gate (`PROMOTE_TO_PROD=true`) + smoke checks
  - Staging/prod stages are gated by a quality-check stage (`lint`, `typecheck`, `test`, `build`).
- `scripts/ci/vercel-deploy.sh`
  - Reusable deploy helper wrapping `vercel pull`, `vercel build`, `vercel deploy`.
  - Supports `preview`, `staging`, and `production` modes.
  - Emits deployment URL for downstream smoke checks and optional alias assignment.
- `scripts/ci/run-smoke-tests.mjs`
  - HTTP smoke checks for `/`, `/login`, `/dashboard`, `/explorer` against deployed URLs.

## Component Explorer + Tip Linking (BD-012, BD-013)

Route param safety:
- `src/lib/workspace-route.ts`
  - Encodes workspace IDs into base64url route tokens and decodes them on read.
  - Prevents navigation failures when workspace IDs contain `/` (for example `media-press/hubert`).

### Explorer routes
- `src/routes/explorer.tsx` (`/explorer`)
  - Lists latest available workspaces from succeeded scan runs.
  - Uses `ssr: false` because the page depends on client-only Convex hooks.
- `src/routes/explorer.$workspaceId.tsx` (`/explorer/$workspaceId`)
  - Workspace overview with projects, libraries, and dependency edge list.
  - Renders nested explorer child routes (`project`, `lib`, `component`) via `<Outlet />` when subpaths are active.
  - Uses `ssr: false` for client-rendered graph queries.
- `src/routes/explorer.$workspaceId.project.$projectName.tsx` (`/explorer/$workspaceId/project/$projectName`)
  - Project detail with components and incoming/outgoing graph edges.
  - Uses `ssr: false` for client-rendered graph queries.
- `src/routes/explorer.$workspaceId.lib.$libraryName.tsx` (`/explorer/$workspaceId/lib/$libraryName`)
  - Library-specific detail view (validates project type is `library`).
  - Uses `ssr: false` for client-rendered graph queries.
- `src/routes/explorer.$workspaceId.component.$componentId.tsx` (`/explorer/$workspaceId/component/$componentId`)
  - Component metadata, project-level dependency context, related published tips, and watchlist subscribe/unsubscribe controls.
  - Uses `ssr: false` for client-rendered graph queries.

### Explorer query/mutation surface
- `listComponentExplorerWorkspaces(actor...)`
  - Reader-gated list of latest succeeded scan snapshots grouped by workspace.
- `getComponentExplorerWorkspace(actor..., workspaceId)`
  - Returns latest workspace graph metadata, enriched project/library lists, and sorted dependencies.
- `getComponentExplorerProject(actor..., workspaceId, projectName)`
  - Returns one project with component inventory and incoming/outgoing dependencies.
- `getComponentExplorerComponent(actor..., workspaceId, componentId)`
  - Returns component detail and related published tips resolved from tip-component links.
- `listTipComponentLinksForEditor(actor..., tipId)`
  - Reader for existing tip-component links in the dashboard editor.
- `saveTipDraft(..., componentLinks?)`
  - Draft save path now optionally replaces the link set for the tip.

### Related published tips behavior
- Component detail pages resolve links by exact component identity:
  - `workspaceId`
  - `projectName`
  - `componentName`
  - `componentFilePath`
- Only tips in `published` state are shown in the related list.
- Organization scoping is applied to both links and tip records when `actorOrganizationId` is set.

## Watchlist + Notifications (BD-016)

### Data model
- `componentWatchSubscriptions`:
  - Component-level watch registrations keyed by watcher + component identity
    (`workspaceId`, `projectName`, `componentName`, `componentFilePath`).
- `watchNotifications`:
  - Per-watcher in-app notification log rows with:
    - event type (`tip.published`, `tip.updated`)
    - delivery metadata (`deliveryChannel`, `deliveryStatus`)
    - component identity
    - tip metadata (`tipId`, `tipSlug`, `tipTitle`, `revisionNumber`)
    - read state (`isRead`, `readAt`)

### API surface
- Watch subscriptions:
  - `getComponentWatchStatus(actor..., workspaceId, projectName, componentName, componentFilePath)`
  - `listMyComponentWatchSubscriptions(actor..., limit?)`
  - `subscribeToComponentWatchlist(actor..., workspaceId, projectName, componentName, componentFilePath)`
  - `unsubscribeFromComponentWatchlist(actor..., workspaceId, projectName, componentName, componentFilePath)`
- Notifications:
  - `listWatchNotifications(actor..., unreadOnly?, limit?)`
  - `markWatchNotificationRead(actor..., notificationId)`
  - `markAllWatchNotificationsRead(actor..., limit?)`
- Notification fanout:
  - `publishTip` now fans out component-linked notifications to subscribed watchers and returns notification count + event type.

### UI surface
- Component detail route: `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - Adds watch/unwatch controls and watcher count visibility.
- Dashboard route: `src/routes/dashboard.tsx`
  - Adds watchlist management and notification inbox (filter unread, mark read, mark all read).

## Launch Hardening (BD-017)

Artifacts:
- Launch runbook: `docs/launch-runbook.md`
- Backup/restore validation drill: `docs/backup-restore-validation.md`
