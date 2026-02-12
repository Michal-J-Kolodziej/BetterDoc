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
  - Mounts `ConvexAppProvider` so route components can call Convex hooks.
- Index route: `src/routes/index.tsx`
  - Public landing page with links into auth flow and protected dashboard.

### Convex integration
- Convex client provider: `src/lib/convex-client.tsx`
  - Initializes `ConvexReactClient` using validated `VITE_CONVEX_URL`.
- Convex function: `convex/health.ts`
  - Exposes `getStatus` query for initial end-to-end health check.
- Convex schema: `convex/schema.ts`
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
  - Authenticated requests call `next()` and render dashboard component.
