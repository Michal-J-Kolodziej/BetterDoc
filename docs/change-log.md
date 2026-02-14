# BetterDoc Change Log

## 2026-02-14 (V2 ground-up redesign: posts + teams + comments)
- Code paths changed:
  - `convex/schema.ts`
  - `convex/model.ts`
  - `convex/auth.ts`
  - `convex/users.ts`
  - `convex/teams.ts`
  - `convex/posts.ts`
  - `convex/comments.ts`
  - `convex/files.ts`
  - `convex/http.ts`
  - `src/routes/__root.tsx`
  - `src/routes/index.tsx`
  - `src/routes/dashboard.tsx`
  - `src/routes/posts.$postId.tsx`
  - `src/routes/teams.tsx`
  - `src/routes/profile.tsx`
  - `src/styles.css`
  - `src/components/ui/*` (Shadcn component set)
  - `src/lib/search.ts`
  - `src/lib/uploads.ts`
  - `src/lib/use-debounced-value.ts`
  - `src/features/app-types.ts`
  - `package.json`
- Code paths removed:
  - `.azure-pipelines/*`
  - `convex/accessControl.ts`
  - `convex/rbac.ts`
  - `convex/scanIngestion*.ts`
  - `convex/tipDraft.ts`
  - `src/routes/explorer*`
  - `src/features/explorer/*`
  - `src/features/dashboard/*` (legacy tabbed tips dashboard)
  - `scripts/angular-scanner.ts`
  - `scripts/manual-sync-azure-repo.ts`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/operations.md`
  - `docs/change-log.md`
- Impact:
  - Replaced the previous tips/explorer/scanner product with BetterDoc V2: team-scoped posts, comments, image attachments, profile IID, team invites/role management, post archive/unarchive, and dashboard search filters.
  - Migrated UI primitives to Shadcn + Tailwind and removed legacy custom shell component system.
  - Removed Azure and Angular scanner operational/deployment surface from active codebase.

## 2026-02-13 (Tailwind UX redesign + tabbed dashboard shell)
- Code paths changed:
  - `package.json`
  - `vite.config.ts`
  - `src/styles.css`
  - `src/styles/tokens.css`
  - `src/styles/base.css`
  - `src/styles/components.css`
  - `src/styles/motion.css`
  - `src/lib/classnames.ts`
  - `src/components/ui/AppShell.tsx`
  - `src/components/ui/SidebarRail.tsx`
  - `src/components/ui/PageTopbar.tsx`
  - `src/components/ui/Tabs.tsx`
  - `src/components/ui/Panel.tsx`
  - `src/components/ui/StatusChip.tsx`
  - `src/components/ui/MetricStrip.tsx`
  - `src/components/ui/EntityList.tsx`
  - `src/features/explorer/ExplorerLayout.tsx`
  - `src/features/dashboard/DashboardTabs.tsx`
  - `src/features/dashboard/types.ts`
  - `src/features/dashboard/panels/OverviewPanel.tsx`
  - `src/features/dashboard/panels/TipStudioPanel.tsx`
  - `src/features/dashboard/panels/WorkflowPanel.tsx`
  - `src/features/dashboard/panels/SearchPanel.tsx`
  - `src/features/dashboard/panels/WatchlistPanel.tsx`
  - `src/features/dashboard/panels/AuditPanel.tsx`
  - `src/routes/index.tsx`
  - `src/routes/dashboard.tsx`
  - `src/routes/explorer.tsx`
  - `src/routes/explorer.$workspaceId.tsx`
  - `src/routes/explorer.$workspaceId.project.$projectName.tsx`
  - `src/routes/explorer.$workspaceId.lib.$libraryName.tsx`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Migrated the app UI to Tailwind v4 with Vite plugin integration and layered token/base/component/motion style modules.
  - Replaced border-heavy route markup with reusable shell primitives and feature panels across home, dashboard, and explorer route families.
  - Added URL-synced dashboard tabs (`tab`) with normalization to `overview` for missing/invalid values while preserving existing auth, RBAC, Convex query/mutation behavior.
  - Updated explorer route head metadata so smoke checks still detect expected shell text (`Component Explorer`).

## 2026-02-13 (Dark surface pass: removed white backgrounds)
- Code paths changed:
  - `src/styles.css`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Reworked global desktop styling tokens and component surface styles to remove white/light panel backgrounds in favor of dark green/graphite surfaces.
  - Updated shells, cards, form controls, links, and action chips so the app now follows a fully dark visual baseline aligned with stitch-inspired references.

## 2026-02-13 (Structure refactor for stitch-style desktop shells)
- Code paths changed:
  - `src/routes/dashboard.tsx`
  - `src/routes/index.tsx`
  - `src/routes/explorer.tsx`
  - `src/routes/explorer.$workspaceId.tsx`
  - `src/routes/explorer.$workspaceId.project.$projectName.tsx`
  - `src/routes/explorer.$workspaceId.lib.$libraryName.tsx`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - `src/styles.css`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Refactored UI markup from mostly single-column `<main>/<section>/<p>` stacks into shell-based desktop structures that more closely match stitch references: sidebar navigation, top headers, content panes, and card-list rows.
  - Added reusable class-driven shell styling for dashboard and explorer route families while preserving all existing query/mutation/auth/RBAC behaviors.
  - Updated landing/home route structure to match the same desktop visual language and action hierarchy.

## 2026-02-13 (Desktop UI styling refresh)
- Code paths changed:
  - `src/styles.css`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Replaced the baseline global stylesheet with a desktop-focused design system based on stitch mock references, including layered background treatment, glass-card layout, expressive typography, and motion polish.
  - Unified visual treatment for all shared primitives (`main`, `section`, labels, links, code chips, inputs/selects/textareas, buttons, checkbox/radio states, validation messages) so dashboard, explorer, and landing routes inherit consistent styling without behavior changes.

## 2026-02-13 (Explorer workspace route param fix)
- Code paths changed:
  - `src/lib/workspace-route.ts`
  - `src/routes/explorer.tsx`
  - `src/routes/explorer.$workspaceId.tsx`
  - `src/routes/explorer.$workspaceId.project.$projectName.tsx`
  - `src/routes/explorer.$workspaceId.lib.$libraryName.tsx`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - `src/routes/dashboard.tsx`
- Documentation updated:
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Fixed explorer navigation by rendering child routes from `src/routes/explorer.tsx` via `<Outlet />`, which was previously missing and prevented child pages from appearing after link clicks.
  - Fixed nested workspace child navigation (`Open project view`, library/component routes) by rendering child routes from `src/routes/explorer.$workspaceId.tsx` via `<Outlet />`.
  - Added slash-safe workspace route token encoding/decoding (`src/lib/workspace-route.ts`) so workspace IDs containing `/` route correctly in explorer links and Convex queries.
  - Marked `/dashboard` as client-rendered (`ssr: false`) to prevent server-side Convex hook execution outside `ConvexProvider`.

## 2026-02-13 (BD-014 follow-up: pipeline-free sync option)
- Code paths changed:
  - `scripts/manual-sync-azure-repo.ts`
  - `package.json`
  - `.env.example`
- Documentation updated:
  - `docs/operations.md`
  - `docs/codebase-reference.md`
  - `docs/change-log.md`
- Impact:
  - Added a manual Azure-repo sync command (`bun run sync:azure-repo`) that clones a repo, runs the Angular scanner, and posts payloads to Convex ingestion without requiring Azure Pipeline setup.
  - Improved manual sync operability by auto-detecting a single nested Angular workspace, requiring explicit `--workspace-subpath` only when multiple workspaces exist, and normalizing Convex ingest URLs from `.convex.cloud` to `.convex.site`.

## 2026-02-13 (BD-015, BD-016, BD-017)
- Code paths changed:
  - `.azure-pipelines/vercel-deploy.yml`
  - `scripts/ci/vercel-deploy.sh`
  - `scripts/ci/run-smoke-tests.mjs`
  - `package.json`
  - `convex/schema.ts`
  - `convex/accessControl.ts`
  - `src/routes/explorer.$workspaceId.component.$componentId.tsx`
  - `src/routes/dashboard.tsx`
- Documentation updated:
  - `docs/operations.md`
  - `docs/codebase-reference.md`
  - `docs/security-and-access.md`
  - `docs/launch-runbook.md`
  - `docs/backup-restore-validation.md`
  - `docs/change-log.md`
- Impact:
  - Added a gated Azure-to-Vercel deployment pipeline for preview/staging/prod with smoke-test enforcement and manual production promotion control.
  - Added component watchlist subscriptions and in-app notification logging/delivery state for component-linked tip publish/update events, plus dashboard and component-page UX for subscribe/read workflows.
  - Added launch hardening artifacts: production runbook, rollback procedure, smoke-check command path, and Convex backup/restore validation drill documentation.

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
