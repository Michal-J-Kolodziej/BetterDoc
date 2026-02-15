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
  - Inline status chips (`all/active/resolved/archived`) + inline team selector in main content controls.
  - Create-post dialog includes team template picker and template save/update/delete controls.
  - Create-post draft autosaves every 1.5 seconds and supports restore/discard per user+team.
  - Create-post dialog includes a non-blocking similar-incidents panel:
    - Visible once combined compose input reaches 20 characters.
    - Similar lookup is debounced by 350ms.
    - Shows `Possible duplicate` when top score is `>= 0.65`.
    - Provides deep links to `/posts/$postId`.
  - Successful post creation clears the associated create-post draft.
  - Description composer supports `@` mention picking via `teams.searchTeamMembers` and inserts IID mentions (`@BD-XXXXXXXX`).
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
  - Post edit/resolve/reopen/archive/unarchive plus compact discussion composer and comment CRUD.
  - Resolve action requires a non-empty resolution summary and sets post status to `resolved`.
  - Reopen action is available from `resolved` state only and returns the post to `active`.
  - Resolved and archived posts are read-only for post/comment edits and new comment creation until reopened/unarchived.
  - Teamleader/admin can promote resolved posts to team-private playbooks.
  - Comment composer draft autosaves every 1.5 seconds and supports restore/discard per user+post.
  - Successful comment creation clears the associated comment draft.
  - Post description and comment composers support `@` mention picking with IID insertion.
  - Detail and discussion surfaces use shared tape-style sections and row separators instead of nested card stacks.
- `src/routes/playbooks.tsx`
  - Protected team-private playbook route.
  - Team selector + list/detail view backed by `playbooks.listTeamPlaybooks` and `playbooks.getPlaybookDetail`.
  - Playbooks are promoted from resolved posts only and linked back to source post detail.
- `src/routes/analytics.tsx`
  - Protected team-private analytics route.
  - Team selector + range selector (`30` or `90` days).
  - Displays separate resolved vs archived counts, unresolved open count, median time-to-resolution (resolved-only), recurring topics, and top contributors.
- `src/routes/inbox.tsx`
  - Protected in-app inbox route with cursor pagination, deep links, and per-item/mark-all read controls.
  - Opening an inbox notification link marks the item read before navigation.
- `src/routes/teams.tsx`
  - Uses shared protected desktop shell with persistent left nav.
  - Team management with split create/invite + member management surfaces.
  - Invite and member areas are rendered as divider lists to reduce border-heavy visual noise.
  - IID/email/link invite creation, copyable join URLs, active-link revoke list, role assignment, member removal, invite responses.
- `src/routes/join.$token.tsx`
  - Protected token acceptance flow for `/join/$token` invite URLs.
  - Calls `teams.acceptInviteToken` and renders accepted/already-accepted outcomes.
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
  - Provides fixed desktop two-column shell with persistent left navigation (`Dashboard`, `Playbooks`, `Analytics`, `Inbox`, `Teams`, `Profile`, `Logout`) and account footer block.
  - Displays reactive unread badge counts in sidebar and header inbox entry points using `notifications.getUnreadCount`.
  - Shell styling is intentionally flatter (minimal paneling, separator-first hierarchy) to match dashboard V1.
- Mention input UI:
  - `src/components/mentions/mention-textarea.tsx`
  - Detects `@` mention triggers at the current textarea caret and queries `teams.searchTeamMembers` for inline IID mention insertion.
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
- Similar incidents composer helpers: `src/lib/similar-incidents.ts`
- Convex upload client flow: `src/lib/uploads.ts`
- User display-name fallback logic: `src/utils/user-display.ts`

## Convex Backend (V2 Domain)
- Schema: `convex/schema.ts`
- Shared validators/constants: `convex/model.ts`
  - Includes notification type validators and draft retention helper (`resolveDraftExpiresAt`).
- Authorization helpers: `convex/auth.ts`
- Post search-text builder: `convex/postSearch.ts`
- Domain function modules:
  - `convex/inviteTokens.ts`
  - `convex/analytics.ts`
  - `convex/drafts.ts`
  - `convex/templates.ts`
  - `convex/users.ts`
  - `convex/teams.ts`
  - `convex/playbooks.ts`
  - `convex/posts.ts`
  - `convex/postSimilarity.ts`
  - `convex/comments.ts`
  - `convex/mentions.ts`
  - `convex/notifications.ts`
  - `convex/files.ts`
- Optional health endpoint: `convex/health.ts`
- HTTP router (currently no custom routes): `convex/http.ts`

### Convex Tables
- `users`
- `teams`
- `teamMemberships`
- `teamInvites`
- `teamEmailInvites`
- `teamInviteLinks`
- `posts`
- `playbooks`
- `postTemplates`
- `postDrafts`
- `commentDrafts`
- `comments`
- `notifications`

### Core API Surface
- `users.getMe`, `users.upsertMe`, `users.updateProfile`
- `teams.createTeam`, `teams.listMyTeams`, `teams.listTeamMembers`, `teams.searchTeamMembers`, `teams.inviteByIID`, `teams.inviteByEmail`, `teams.createInviteLink`, `teams.listTeamInviteLinks`, `teams.acceptInviteToken`, `teams.revokeInviteLink`, `teams.listMyInvites`, `teams.respondInvite`, `teams.updateMemberRole`, `teams.removeMember`
- `posts.createPost`, `posts.updatePost`, `posts.resolvePost`, `posts.reopenPost`, `posts.archivePost`, `posts.unarchivePost`, `posts.listPosts`, `posts.findSimilar`, `posts.getPostDetail`
- `comments.createComment`, `comments.updateComment`, `comments.deleteComment`
- `playbooks.promoteFromPost`, `playbooks.listTeamPlaybooks`, `playbooks.getPlaybookDetail`
- `analytics.getTeamOverview`
- `templates.listTeamTemplates`, `templates.createTemplate`, `templates.updateTemplate`, `templates.deleteTemplate`
- `drafts.getPostDraft`, `drafts.upsertPostDraft`, `drafts.deletePostDraft`, `drafts.getCommentDraft`, `drafts.upsertCommentDraft`, `drafts.deleteCommentDraft`
- `notifications.getUnreadCount`, `notifications.listInbox`, `notifications.markRead`, `notifications.markAllRead`
- `notifications.enqueue`, `notifications.enqueueMany` (internal service primitives)
- `files.generateUploadUrl`, `files.attachUploadedFile`

### Notification/Event Notes
- `teams.inviteByIID` now enqueues `invite_received` notifications for invite recipients.
- `comments.createComment` now enqueues `comment_on_post` notifications to the post creator when the commenter is a different user.
- Post/comment mention parsing uses IID tokens (`@BD-XXXXXXXX`) and notifies only newly added mentions on create/update.
- Mention notifications skip self-notifications and ignore users who are not current members of the referenced team.
- Mention dedupe keys are scoped to entity+recipient (`mention_in_post:${postId}:${recipientId}`, `mention_in_comment:${commentId}:${recipientId}`).
- Notification enqueue is deduplicated by `dedupeKey` (`notifications.by_dedupe_key` index) to keep retried events single-write.

### Team Invite Notes
- IID invites (`teamInvites`) remain unchanged for internal IID-based invites and inbox notifications.
- Email invites (`teamEmailInvites`) are tokenized and email-bound: acceptance requires logged-in user email match.
- Link invites (`teamInviteLinks`) enforce default `14-day` expiry and default `25` max uses.
- Invite token storage is hash-only (`SHA-256` via `tokenHash` indexes); plain tokens are only returned at creation time.
- Link acceptance is replay-safe for the same user (`usedByUserIds`), so repeated token submissions are idempotent and do not consume extra uses.

### Similar Incident Notes
- `posts.findSimilar` is team-scoped and enforces same-team membership before reading candidate posts.
- Ranking combines token overlap (Jaccard-like over normalized `[title, where, when, description]` tokens) and a bounded recency boost.
- Ranking order is deterministic using tie-breaks: `score`, `tokenOverlap`, `recencyBoost`, `lastActivityAt`, `createdAt`, then `postId`.
- API supports `excludePostId`; default `limit` is `5` and hard max is `10`.
- Performance baseline:
  - Query reads recent team posts via `posts.by_team_last_activity` and scores up to `max(limit * 30, 200)` candidates.
  - Expected runtime is linear in candidate count (`O(n)` scoring + sort), suitable for typical team datasets in the low-thousands where recent-window matching is sufficient for compose-time suggestions.

### Post Lifecycle / Playbook / Analytics Notes
- Post status lifecycle now includes `active`, `resolved`, and `archived`.
- `posts.resolvePost` requires post access permission (creator/teamleader/admin) and a non-empty `resolutionSummary`.
- `posts.reopenPost` requires the same permission set and only transitions `resolved -> active`.
- Comment/post mutating flows now enforce `active` status; resolved/archived threads are read-only.
- `playbooks.promoteFromPost` is restricted to `teamleader/admin`, requires a `resolved` source post, and is idempotent per team+source-post.
- `analytics.getTeamOverview` is team-scoped and returns range-bounded (`30|90`) overview metrics with separate resolved vs archived totals, unresolved open count, resolved-only median TTR, recurring topics, and top contributors.

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
