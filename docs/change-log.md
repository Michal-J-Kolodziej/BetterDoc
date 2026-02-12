# BetterDoc Change Log

## 2026-02-12 (BD-014)
- Code paths changed:
  - `.azure-pipelines/incremental-scan.yml`
  - `.azure-pipelines/nightly-full-scan.yml`
  - `scripts/ci/post-scan-ingestion.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Added Azure DevOps YAML definitions for PR/merge incremental scan ingestion and nightly full scan ingestion, wired to `POST /scanner/ingest` through a reusable CI script with configurable timeout/retry backoff and secret-backed endpoint/token references.

## 2026-02-12 (BD-012, BD-013)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/accessControl.ts`
  - `src/routes/explorer.tsx`
  - `src/routes/explorer.$workspaceId.tsx`
  - `src/routes/explorer.$workspaceId.project.$projectName.tsx`
  - `src/routes/explorer.$workspaceId.lib.$libraryName.tsx`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - `src/routes/dashboard.tsx`
  - `src/routes/index.tsx`
  - `src/routeTree.gen.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Delivered component explorer navigation for workspace/project/library/component views with dependency graph visibility, added many-to-many tip-to-component linking in the dashboard editor, and exposed related published tips on component detail pages via new Convex explorer/linking queries.
  - Marked explorer routes as client-rendered (`ssr: false`) to keep Convex query hooks inside the client provider tree.

## 2026-02-12 (BD-011)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/scanIngestion.ts`
  - `convex/scanIngestionInternal.ts`
  - `convex/http.ts`
  - `src/lib/scan-ingestion.ts`
  - `src/lib/scan-ingestion.test.ts`
  - `convex/_generated/api.d.ts`
- Documentation updated:
  - `docs/scanner-ingestion-api.md`
  - `docs/codebase-reference.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Added idempotent/retry-safe scanner snapshot ingestion with `scanRuns` + versioned component graph persistence and a dedicated HTTP contract (`POST /scanner/ingest`) for pipeline integrations.

## 2026-02-12 (BD-010)
- Code paths changed:
  - `package.json`
  - `scripts/angular-scanner.ts`
  - `src/lib/angular-scanner.ts`
  - `src/lib/angular-scanner.test.ts`
- Documentation updated:
  - `docs/angular-scanner-cli.md`
  - `docs/codebase-reference.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Added Angular scanner CLI support for deterministic JSON snapshots of workspace projects/libraries/components/internal dependencies with clear structured error reporting and automated test coverage.

## 2026-02-12 (BD-008, BD-009)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/accessControl.ts`
  - `convex/tipDraft.ts`
  - `src/routes/dashboard.tsx`
  - `src/lib/tip-editor.ts`
  - `src/lib/tip-editor.test.ts`
  - `src/lib/tip-draft.server.test.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/change-log.md`
- Impact:
  - Added validated tip lifecycle transitions (`draft`, `in_review`, `published`, `deprecated`) with reviewer-gated publish/deprecate actions, introduced indexed multi-filter tip search (text/project/library/component/tag/status), and updated dashboard UX for workflow, filtering, and empty/error/permission handling.

## 2026-02-12 (BD-006, BD-007)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/accessControl.ts`
  - `convex/tipDraft.ts`
  - `convex/_generated/api.d.ts`
  - `src/routes/dashboard.tsx`
  - `src/lib/tip-editor.ts`
  - `src/lib/tip-editor.test.ts`
  - `src/lib/tip-draft.server.test.ts`
  - `src/styles.css`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/change-log.md`
- Impact:
  - Delivered structured tips + revision persistence with server/client validation, added a draft editor UI for symptom/root-cause/fix/prevention/tags/references, and wired draft saves to immutable `tipRevisions` history.

## 2026-02-12 (BD-004, BD-005)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/rbac.ts`
  - `convex/accessControl.ts`
  - `convex/_generated/api.d.ts`
  - `src/routes/__root.tsx`
  - `src/routes/dashboard.tsx`
  - `src/lib/rbac.ts`
  - `src/lib/rbac.test.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/change-log.md`
- Impact:
  - Added Reader/Contributor/Reviewer/Admin RBAC model, enforced role checks in Convex queries/mutations and dashboard UI guards, and introduced immutable audit events for publish/deprecate/role/integration privileged actions.

## 2026-02-12 (BD-003 follow-up)
- Code paths changed:
  - `src/start.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Fixed client runtime crash caused by eager server env validation import path; auth middleware now reads redirect override from public `VITE_WORKOS_REDIRECT_URI`.

## 2026-02-12 (BD-003 callback port hardening)
- Code paths changed:
  - `vite.config.ts`
- Documentation updated:
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Locked Vite dev server to port `3000` with strict port behavior so WorkOS callback URI remains stable during local sign-in flow.

## 2026-02-11
- Code paths changed:
  - `package.json`
  - `bun.lock`
  - `vite.config.ts`
  - `vitest.config.ts`
  - `eslint.config.js`
  - `tsconfig.json`
  - `.env.example`
  - `.gitignore`
  - `src/router.tsx`
  - `src/routes/__root.tsx`
  - `src/routes/index.tsx`
  - `src/config/env.shared.ts`
  - `src/config/env.client.ts`
  - `src/config/env.server.ts`
  - `src/config/platform.ts`
  - `src/config/workos.server.ts`
  - `src/config/env.shared.test.ts`
  - `src/lib/convex-client.tsx`
  - `src/styles.css`
  - `scripts/validate-env.ts`
  - `convex/schema.ts`
  - `convex/health.ts`
  - `convex/_generated/api.ts`
  - `convex/_generated/server.ts`
  - `convex/_generated/dataModel.ts`
  - `convex.json`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Delivered BD-001 and BD-002 foundation: TanStack Start scaffold, Convex client wiring, validated `dev/staging/prod` env strategy, and operational scripts for lint/typecheck/test/build.

## 2026-02-11 (BD-003)
- Code paths changed:
  - `package.json`
  - `bun.lock`
  - `.env.example`
  - `src/start.ts`
  - `src/routes/login.tsx`
  - `src/routes/logout.tsx`
  - `src/routes/dashboard.tsx`
  - `src/routes/api/auth/callback.tsx`
  - `src/routes/index.tsx`
  - `src/routeTree.gen.ts`
  - `src/config/env.shared.ts`
  - `src/config/env.server.ts`
  - `src/config/workos.server.ts`
  - `src/config/env.shared.test.ts`
  - `scripts/validate-env.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Delivered WorkOS SSO login/logout/callback flow with middleware-backed sessions, protected dashboard access checks, and secure cookie environment controls.
