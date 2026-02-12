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
- Convex scan ingestion modules:
  - `convex/scanIngestion.ts`
    - Public action: `ingestScannerSnapshot`
    - Public query: `getLatestSuccessfulScanRun`
  - `convex/scanIngestionInternal.ts`
    - Internal mutations: `acquireScanRunForIngestion`, `finalizeScanRunSuccess`, `markScanRunFailed`
  - `convex/http.ts`
    - HTTP endpoint: `POST /scanner/ingest` (bridges JSON payloads to `ingestScannerSnapshot`)
- Convex RBAC/audit module: `convex/accessControl.ts`
  - Public queries: `getAccessProfile`, `listTips`, `getTipForEditor`, `listTipRevisions`, `listAuditEvents`.
  - Public mutations: `bootstrapFirstAdmin`, `assignRole`, `saveTipDraft`, `submitTipForReview`, `returnTipToDraft`, `publishTip`, `deprecateTip`, `configureIntegration`.
  - Enforces capability checks server-side for privileged operations and audit reads.
- RBAC constants/validators: `convex/rbac.ts`
- Convex schema: `convex/schema.ts`
  - Tables: `memberships`, `tips`, `tipRevisions`, `tipTagFacets`, `scanRuns`, `componentGraphHeads`, `componentGraphVersions`, `componentGraphProjects`, `componentGraphComponents`, `componentGraphDependencies`, `integrationConfigs`, `auditEvents`.
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
  - `saveTipDraft` creates or updates draft content, enforces valid transition to `draft` (including reviewer requirement for `in_review -> draft` edits), updates tag facets, and appends a revision snapshot.
  - `submitTipForReview` transitions `draft -> in_review`.
  - `returnTipToDraft` transitions `in_review -> draft` (review feedback loop).
  - `publishTip` transitions `in_review -> published` and writes an audit event.
  - `deprecateTip` transitions `published -> deprecated` and writes an audit event.
  - Invalid transitions are rejected server-side by `assertStatusTransition()`.
  - `listTipRevisions` returns newest-first revision metadata for editor history.
  - `getTipForEditor` reads structured tip content for edit workflows.
  - Existing-tip writes and transitions enforce organization-scoped access.

### Editor UI
- `src/routes/dashboard.tsx`
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
  - Includes an explicit load action to populate the editor from an existing tip.
  - Adds workflow controls for submit/review return/publish/deprecate with status-aware button gating.
  - Adds a search/filter section with empty, local-validation error, and permission-denied states.
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
