# BetterDoc Codebase Reference

Last updated: 2026-02-11

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
- Root route: `src/routes/__root.tsx`
  - Owns the HTML document shell and global providers.
  - Mounts `ConvexAppProvider` so route components can call Convex hooks.
- Index route: `src/routes/index.tsx`
  - Demonstrates typed Convex API usage with `useQuery(api.health.getStatus)`.

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
