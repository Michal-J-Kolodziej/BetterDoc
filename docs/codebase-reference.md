# BetterDoc Codebase Reference

Last updated: 2026-02-15

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
  - Public dark landing surface using the same V1 tape-feed visual language as protected routes.
  - Primary sign-in CTA and dashboard shortcut with minimal, low-chrome framing.
- `src/routes/login.tsx`
  - WorkOS redirect entrypoint.
- `src/routes/api/auth/callback.tsx`
  - WorkOS callback/session exchange.
- `src/routes/logout.tsx`
  - WorkOS sign-out + session clear.
- `src/routes/dashboard.tsx`
  - Protected post board dashboard.
  - Uses shared protected desktop shell with persistent left sidebar nav.
  - Search bar supports free text and qualifiers (`team:`, `status:`, `author:`, `has:image`, `before:`, `after:`).
  - Inline status chips + inline team selector in main content controls.
  - Create-post dialog includes team template picker and template save/update/delete controls.
  - Create-post draft autosaves every 1.5 seconds and supports restore/discard per user+team.
  - Successful post creation clears the associated create-post draft.
  - Main feed now renders as divider-based tape rows (instead of stacked cards) for higher scan density.
- `src/routes/dashboard_.v1.tsx`
- `src/routes/dashboard_.v2.tsx`
- `src/routes/dashboard_.v3.tsx`
- `src/routes/dashboard_.v4.tsx`
- `src/routes/dashboard_.v5.tsx`
  - Protected dashboard design review surfaces at `/dashboard/v1` through `/dashboard/v5`.
  - Use a shared variant page module to keep auth/data behavior consistent across all five previews.
  - Variants are intentionally low-chrome (minimal framing, no glow-button treatment in preview UI).
- `src/routes/posts.$postId.tsx`
  - Protected post detail view.
  - Uses shared protected desktop shell; sidebar highlights Dashboard nav.
  - Post edit/archive/unarchive plus compact discussion composer and comment CRUD.
  - Comment composer draft autosaves every 1.5 seconds and supports restore/discard per user+post.
  - Successful comment creation clears the associated comment draft.
  - Detail and discussion surfaces use shared tape-style sections and row separators instead of nested card stacks.
- `src/routes/teams.tsx`
  - Uses shared protected desktop shell with persistent left nav.
  - Team management with split create/invite + member management surfaces.
  - Invite and member areas are rendered as divider lists to reduce border-heavy visual noise.
  - IID invites, role assignment, member removal, invite responses.
- `src/routes/profile.tsx`
  - Uses shared protected desktop shell with persistent left nav.
  - Profile editor with identity panel, avatar upload, and IID copy.
  - Uses one compact tape surface with divider-based metadata/form grouping.

## UI System (Shadcn + Tailwind)
- Global styling/tokens: `src/styles.css`
  - Noir Grid dark-only theme tokens (charcoal base, cyan/lime accents, compact spacing).
  - Google font stack: `Space Grotesk` + `IBM Plex Mono`.
  - Layered background treatment (muted radial highlights + subtle grid overlay).
  - Motion baseline (`180ms` reveal) with strict reduced-motion override.
  - Desktop-only layout utilities (`app-desktop-shell`, `app-sidebar`, `app-main`, `app-content-stack`) with fixed columns and horizontal overflow on narrow viewports.
  - Shared tape-style utilities (`tape-surface`, `tape-list`, `tape-list-row`, `tape-meta`) for low-chrome section and list composition.
- Shared utility: `src/lib/utils.ts` (`cn` helper)
- Shared protected route shell:
  - `src/components/layout/app-sidebar-shell.tsx`
  - Provides fixed desktop two-column shell with persistent left navigation (`Dashboard`, `Teams`, `Profile`, `Logout`) and account footer block.
  - Shell styling is intentionally flatter (minimal paneling, separator-first hierarchy) to match dashboard V1.
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
- Dashboard redesign review variants (shared module): `src/features/dashboard-variants/page.tsx`
- Dashboard search parser/stringifier: `src/lib/search.ts`
- Debounce hook: `src/lib/use-debounced-value.ts`
- Convex upload client flow: `src/lib/uploads.ts`
- User display-name fallback logic: `src/utils/user-display.ts`

## Convex Backend (V2 Domain)
- Schema: `convex/schema.ts`
- Shared validators/constants: `convex/model.ts`
  - Includes notification type validators and draft retention helper (`resolveDraftExpiresAt`).
- Authorization helpers: `convex/auth.ts`
- Post search-text builder: `convex/postSearch.ts`
- Domain function modules:
  - `convex/drafts.ts`
  - `convex/templates.ts`
  - `convex/users.ts`
  - `convex/teams.ts`
  - `convex/posts.ts`
  - `convex/comments.ts`
  - `convex/notifications.ts`
  - `convex/files.ts`
- Optional health endpoint: `convex/health.ts`
- HTTP router (currently no custom routes): `convex/http.ts`

### Convex Tables
- `users`
- `teams`
- `teamMemberships`
- `teamInvites`
- `posts`
- `postTemplates`
- `postDrafts`
- `commentDrafts`
- `comments`
- `notifications`

### Core API Surface
- `users.getMe`, `users.upsertMe`, `users.updateProfile`
- `teams.createTeam`, `teams.listMyTeams`, `teams.listTeamMembers`, `teams.inviteByIID`, `teams.listMyInvites`, `teams.respondInvite`, `teams.updateMemberRole`, `teams.removeMember`
- `posts.createPost`, `posts.updatePost`, `posts.archivePost`, `posts.unarchivePost`, `posts.listPosts`, `posts.getPostDetail`
- `comments.createComment`, `comments.updateComment`, `comments.deleteComment`
- `templates.listTeamTemplates`, `templates.createTemplate`, `templates.updateTemplate`, `templates.deleteTemplate`
- `drafts.getPostDraft`, `drafts.upsertPostDraft`, `drafts.deletePostDraft`, `drafts.getCommentDraft`, `drafts.upsertCommentDraft`, `drafts.deleteCommentDraft`
- `notifications.enqueue`, `notifications.enqueueMany` (internal service primitives)
- `files.generateUploadUrl`, `files.attachUploadedFile`

### Notification/Event Notes
- `teams.inviteByIID` now enqueues `invite_received` notifications for invite recipients.
- `comments.createComment` now enqueues `comment_on_post` notifications to the post creator when the commenter is a different user.
- Notification enqueue is deduplicated by `dedupeKey` (`notifications.by_dedupe_key` index) to keep retried events single-write.

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
