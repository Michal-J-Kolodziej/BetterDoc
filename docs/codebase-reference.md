# BetterDoc Codebase Reference

Last updated: 2026-02-14

## Runtime Stack
- Framework: TanStack Start (`@tanstack/react-start`)
- Router: TanStack Router file routes (`src/routes`)
- Frontend: React + TypeScript
- UI system: Shadcn UI components + Tailwind CSS v4
- Backend/data: Convex
- Auth: WorkOS AuthKit
- Deployment target: Vercel (manual process for now)

## App Entry Points
- Router bootstrap: `src/router.tsx`
- Start middleware wiring: `src/start.ts`
  - Registers `authkitMiddleware()` for session handling.
- Root document/providers: `src/routes/__root.tsx`
  - Mounts `AuthKitProvider` + `ConvexAppProvider`.

## Route Surface (V2)
- `src/routes/index.tsx`
  - Public landing page with sign-in CTA.
- `src/routes/login.tsx`
  - WorkOS redirect entrypoint.
- `src/routes/api/auth/callback.tsx`
  - WorkOS callback/session exchange.
- `src/routes/logout.tsx`
  - WorkOS sign-out + session clear.
- `src/routes/dashboard.tsx`
  - Protected post board dashboard.
  - Search bar supports free text and qualifiers (`team:`, `status:`, `author:`, `has:image`, `before:`, `after:`).
  - Create-post dialog with image upload.
- `src/routes/posts.$postId.tsx`
  - Protected post detail view.
  - Post edit/archive/unarchive plus discussion thread and comment CRUD.
- `src/routes/teams.tsx`
  - Protected team management, IID invites, role assignment, member removal, invite responses.
- `src/routes/profile.tsx`
  - Protected profile editor (name/avatar) and IID copy.

## UI System (Shadcn + Tailwind)
- Global styling/tokens: `src/styles.css`
- Shared utility: `src/lib/utils.ts` (`cn` helper)
- Shadcn component primitives in `src/components/ui`:
  - `avatar.tsx`
  - `badge.tsx`
  - `button.tsx`
  - `card.tsx`
  - `command.tsx`
  - `dialog.tsx`
  - `dropdown-menu.tsx`
  - `input.tsx`
  - `label.tsx`
  - `scroll-area.tsx`
  - `select.tsx`
  - `separator.tsx`
  - `sheet.tsx`
  - `skeleton.tsx`
  - `textarea.tsx`

## Frontend Feature Helpers
- Shared feature types: `src/features/app-types.ts`
- Dashboard search parser/stringifier: `src/lib/search.ts`
- Debounce hook: `src/lib/use-debounced-value.ts`
- Convex upload client flow: `src/lib/uploads.ts`
- User display-name fallback logic: `src/utils/user-display.ts`

## Convex Backend (V2 Domain)
- Schema: `convex/schema.ts`
- Shared validators/constants: `convex/model.ts`
- Authorization helpers: `convex/auth.ts`
- Post search-text builder: `convex/postSearch.ts`
- Domain function modules:
  - `convex/users.ts`
  - `convex/teams.ts`
  - `convex/posts.ts`
  - `convex/comments.ts`
  - `convex/files.ts`
- Optional health endpoint: `convex/health.ts`
- HTTP router (currently no custom routes): `convex/http.ts`

### Convex Tables
- `users`
- `teams`
- `teamMemberships`
- `teamInvites`
- `posts`
- `comments`

### Core API Surface
- `users.getMe`, `users.upsertMe`, `users.updateProfile`
- `teams.createTeam`, `teams.listMyTeams`, `teams.listTeamMembers`, `teams.inviteByIID`, `teams.listMyInvites`, `teams.respondInvite`, `teams.updateMemberRole`, `teams.removeMember`
- `posts.createPost`, `posts.updatePost`, `posts.archivePost`, `posts.unarchivePost`, `posts.listPosts`, `posts.getPostDetail`
- `comments.createComment`, `comments.updateComment`, `comments.deleteComment`
- `files.generateUploadUrl`, `files.attachUploadedFile`

## Removed Legacy Areas
The following legacy areas are removed from active code paths:
- Tips workflow and approval lifecycle (`accessControl`, `tipDraft`, revision/facet/link/watchlist flows)
- Angular scanner + scan ingestion backend and scripts
- Component explorer routes/UI
- Azure pipeline configuration under `.azure-pipelines`

## Quality Gates
- `bun run env:validate`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
