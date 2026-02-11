# BetterDoc MVP Backlog (Codex-Ready)

Last updated: 2026-02-11

## Locked Stack
- TanStack Start
- WorkOS (Auth)
- Convex (Backend + Data)
- Vercel (Deployment)
- Azure DevOps Repos (Source + Pipelines)

## Assumptions
- Single company tenant with team/workspace segmentation.
- Primary Azure org/project: `media-press/Hubert`.
- Internal engineering knowledge only (no customer PII in tips).
- Roles: `Reader`, `Contributor`, `Reviewer`, `Admin`.
- Package manager: `pnpm`.

## Prioritized MVP Backlog
| ID | Story | Size | Depends On | MVP Acceptance Criteria |
|---|---|---|---|---|
| BD-001 | Scaffold app foundation with TanStack Start and Convex client wiring | S | None | App boots locally, typed API client works, CI lint/typecheck/test/build passes |
| BD-002 | Environment strategy for `dev/staging/prod` across Vercel + Convex + WorkOS | S | BD-001 | Secrets documented, env validation in code, separate deployment targets configured |
| BD-003 | Implement WorkOS SSO login/logout/callback/session | M | BD-001, BD-002 | Protected routes require auth, session persists, logout invalidates session |
| BD-004 | Implement RBAC model and enforcement in Convex functions and UI guards | M | BD-003 | Unauthorized actions blocked server-side and UI-side for all privileged actions |
| BD-005 | Add immutable audit events for publish/deprecate/role/integration actions | S | BD-004 | Audit entries include actor, org, action, timestamp, target |
| BD-006 | Build tips data model and Convex functions (CRUD + revision history) | M | BD-004 | Contributors can create/edit drafts, revisions stored, reads are role-scoped |
| BD-007 | Build tip editor UI with structured fields and validation | M | BD-006 | Required fields enforced, markdown/rich text supported, save draft works |
| BD-008 | Build review workflow (`draft -> in_review -> published -> deprecated`) | M | BD-006, BD-007 | Reviewer-only publish/deprecate, status transitions validated server-side |
| BD-009 | Search and filtering for tips by text/project/lib/component/tag/status | M | BD-006 | Search p95 under target, filters combinable, empty/error states handled |
| BD-010 | Build Angular scanner CLI for project/lib/component/dependency extraction | L | BD-001 | Scanner outputs deterministic JSON snapshot from sample monorepo |
| BD-011 | Ingest scan snapshots into Convex (`scanRuns`, component graph versioning) | M | BD-010 | Idempotent ingest, failed ingest retries, latest successful scan queryable |
| BD-012 | Build component explorer (tree/list + dependency graph view) | M | BD-011 | Users can navigate project/lib/component and view edges/dependencies |
| BD-013 | Link tips to components and show related tips on component pages | M | BD-009, BD-012 | Many-to-many linking works, component details display relevant published tips |
| BD-014 | Azure DevOps pipeline integration for PR/merge incremental scans + nightly full scan | M | BD-010, BD-011 | Pipeline posts snapshot to Convex endpoint, retries on transient failures |
| BD-015 | Vercel deployment pipeline with preview/staging/prod and gating checks | S | BD-002, BD-003 | Preview URLs on PRs, staging/prod gated by checks, rollback path documented |
| BD-016 | Watchlist + notifications for component-linked tip publish/update | M | BD-013 | Users subscribe/unsubscribe, notifications delivered and logged |
| BD-017 | Hardening: permission-denied/error UX, smoke tests, runbook, backup/restore drill | M | BD-015, BD-016 | UAT checklist passed, basic recovery test documented, launch-readiness review complete |

## Codex Execution Queue (Copy/Paste Prompts)

### 1) Foundation
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-001 and BD-002:
- Set up TanStack Start app structure and Convex client integration.
- Add environment validation for dev/staging/prod.
- Prepare config points for WorkOS, Convex deployment names, and Vercel env vars.
- Add scripts for lint, typecheck, test, build.
Return: changed files, setup decisions, and exact commands run.
```

### 2) Auth
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-003:
- Add WorkOS SSO auth flow (login/logout/callback/session).
- Protect app routes requiring authenticated users.
- Add session handling and secure cookie settings.
Return: auth flow summary, changed files, and local verification steps.
```

### 3) Authorization + Audit
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-004 and BD-005:
- Define roles: Reader, Contributor, Reviewer, Admin.
- Enforce RBAC in Convex queries/mutations and frontend guards.
- Add immutable audit event writes for privileged actions.
Return: RBAC matrix in code comments/docs, changed files, and tests added.
```

### 4) Tips Core
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-006 and BD-007:
- Create Convex schema/functions for tips and tip revisions.
- Build tip editor UI with fields: symptom, root cause, fix, prevention, tags, references.
- Add validation and draft save flow.
Return: schema summary, changed files, and test coverage added.
```

### 5) Review Workflow + Search
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-008 and BD-009:
- Add status workflow with server-side transition validation.
- Build search/filter UI and indexed querying.
- Handle empty/error/permission states.
Return: state machine summary, changed files, and performance notes.
```

### 6) Angular Scanner
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-010:
- Create a scanner CLI that parses Angular repo metadata into JSON:
  projects, libs, components, dependencies, file paths.
- Ensure deterministic output and clear error reporting.
Return: CLI usage docs, sample output schema, changed files, and tests.
```

### 7) Graph Ingestion
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-011:
- Add Convex action/endpoint to ingest scanner snapshots.
- Store scanRuns and version component graph data.
- Add idempotency and retry-safe behavior.
Return: ingestion contract, changed files, and failure-handling tests.
```

### 8) Component Explorer + Linking
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-012 and BD-013:
- Build component explorer views (project/lib/component and dependency graph).
- Add tip-to-component linking UI and data model support.
- Show related published tips on component detail pages.
Return: route map, changed files, and UX screenshots/notes.
```

### 9) Azure DevOps Integration
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-014:
- Add Azure Pipeline definitions for PR/merge incremental scans and nightly full scan.
- Post scan payload to Convex ingestion endpoint.
- Add retries, timeout policy, and pipeline secret references.
Return: pipeline YAML summary, changed files, and operational notes.
```

### 10) Deployment + Launch Hardening
```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.
Implement BD-015, BD-016, BD-017:
- Configure Vercel preview/staging/prod with checks.
- Add component watchlist notifications.
- Add smoke tests, runbook, and backup/restore validation docs.
Return: launch checklist, changed files, and remaining known risks.
```

## MVP Release Gate
1. Auth + RBAC enforced server-side for all privileged actions.
2. Tip lifecycle fully usable by Contributor/Reviewer roles.
3. Angular component inventory and linking flow works on real repo.
4. Azure pipeline syncs scan data reliably to Convex.
5. Audit log records all security-sensitive actions.
6. Staging UAT passes and production rollback procedure is tested.
