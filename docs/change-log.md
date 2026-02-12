# BetterDoc Change Log

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
