# BetterDoc Codebase Reference

Last updated: 2026-03-08

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
  - Public entry page with a desktop-first editorial layout, direct sign-in CTA, and dashboard shortcut.
  - Uses a workspace preview, process list, and incident-record timeline to explain capture/discuss/reuse without generic marketing-card treatments.
  - Adds subtle front-page-only motion (`orbit` drift, queue scan, timeline pulse) plus a mouse-reactive ambient background that shifts softly around desktop pointer movement.
  - Auth entry links use full document navigation so `/login` and `/dashboard` hit server auth redirects instead of client-side route-only transitions.
- `src/routes/login.tsx`
  - WorkOS redirect entrypoint.
- `src/routes/api/auth/callback.tsx`
  - WorkOS callback/session exchange.
- `src/routes/logout.tsx`
  - WorkOS sign-out + session clear.
- `src/routes/dashboard.tsx`
  - Protected post board dashboard.
  - Uses shared protected workspace shell with left navigation on desktop and horizontal nav on narrower viewports.
  - Search bar supports free text and qualifiers (`team:`, `status:`, `author:`, `has:image`, `before:`, `after:`).
  - Toolbar keeps status filters (`all/active/resolved/archived`) and team scoping next to search instead of splitting them into separate header treatments.
  - Create-post dialog includes team template picker and template save/update/delete controls.
  - Create-post draft autosaves every 1.5 seconds and supports restore/discard per user+team.
  - Create-post dialog includes a non-blocking similar-incidents panel:
    - Visible once combined compose input reaches 20 characters.
    - Similar lookup is debounced by 350ms.
    - Shows `Possible duplicate` when top score is `>= 0.65`.
    - Provides deep links to `/posts/$postId`.
  - Successful post creation clears the associated create-post draft.
  - Description composer supports `@` mention picking via `teams.searchTeamMembers` and inserts IID mentions (`@BD-XXXXXXXX`).
  - Main feed renders as queue-style list rows with calmer metadata and lighter status treatment.
- `src/routes/dashboard_.v1.tsx`
- `src/routes/dashboard_.v2.tsx`
- `src/routes/dashboard_.v3.tsx`
- `src/routes/dashboard_.v4.tsx`
- `src/routes/dashboard_.v5.tsx`
  - Protected dashboard design review surfaces at `/dashboard/v1` through `/dashboard/v5`.
  - Use a shared variant page module to keep auth/data behavior consistent across all five previews.
  - Variants are intentionally low-chrome with restrained dark framing and no glow-button treatment in preview UI.
- `src/routes/posts.$postId.tsx`
  - Protected post detail view.
  - Uses shared protected workspace shell; sidebar highlights Dashboard nav.
  - Post edit/resolve/reopen/archive/unarchive plus compact discussion composer and comment CRUD.
  - Resolve action requires a non-empty resolution summary and sets post status to `resolved`.
  - Reopen action is available from `resolved` state only and returns the post to `active`.
  - Resolved and archived posts are read-only for post/comment edits and new comment creation until reopened/unarchived.
  - Teamleader/admin can promote resolved posts to team-private playbooks.
  - Comment composer draft autosaves every 1.5 seconds and supports restore/discard per user+post.
  - Successful comment creation clears the associated comment draft.
  - Post description and comment composers support `@` mention picking with IID insertion.
  - Detail actions, resolution summary, and discussion are grouped into plain card/list sections with the same layout language as the dashboard.
- `src/routes/playbooks.tsx`
  - Protected team-private playbook route.
  - Team selector + responsive list/detail view backed by `playbooks.listTeamPlaybooks` and `playbooks.getPlaybookDetail`.
  - Playbooks are promoted from resolved posts only and linked back to source post detail.
- `src/routes/analytics.tsx`
  - Protected team-private analytics route.
  - Team selector + range selector (`30` or `90` days).
  - Displays separate resolved vs archived counts, unresolved open count, median time-to-resolution (resolved-only), recurring topics, and top contributors in compact summary/list sections.
- `src/routes/instructions.tsx`
  - Protected user-private instruction workspace for agent-ready Angular guidance documents.
  - Does not require team membership; any signed-in user can create instruction documents scoped to their own account.
  - Uses a split workbench layout: a left rail for creation and document selection, then an internal section sidebar that shows one editor panel at a time instead of rendering the entire instruction on one long page.
  - The `Preview` panel exposes direct export actions for the canonical generated artifact: copy the Markdown to clipboard or download the current `.md` file using the same generated filename stored in frontmatter.
  - Seeds new documents from the Angular v21 reference profile, then lets users edit structured sections for code structure, patterns, naming, data handling, library usage, guardrails, and review checks.
  - Saves a generated `.md` representation plus the structured document model so future visual editing and agent round-trips use the same schema.
- `src/routes/inbox.tsx`
  - Protected in-app inbox route with cursor pagination, deep links, and per-item/mark-all read controls.
  - Opening an inbox notification link marks the item read before navigation.
- `src/routes/teams.tsx`
  - Uses shared protected workspace shell with responsive nav behavior.
  - Team management is split into practical sections for team creation, incoming invites, members, and outbound invite flows.
  - Invite and member areas are rendered as list rows with lightweight control panels instead of dense framed cards.
  - IID/email/link invite creation, copyable join URLs, active-link revoke list, role assignment, member removal, invite responses.
- `src/routes/join.$token.tsx`
  - Protected token acceptance flow for `/join/$token` invite URLs.
  - Calls `teams.acceptInviteToken` and renders accepted/already-accepted outcomes in a standalone card layout.
- `src/routes/profile.tsx`
  - Uses shared protected workspace shell with responsive nav behavior.
  - Profile editor separates account identity from editable fields while keeping avatar upload and IID copy in one page.

## UI System (Shadcn + Tailwind)
- Global styling/tokens: `src/styles.css`
  - Restrained dark workspace tokens with muted charcoal surfaces, moss-green primary accents, softened amber support accents, and the same tighter radius scale.
  - Google font stack: `Instrument Sans` + `IBM Plex Mono`.
  - Minimal dark background treatment with subtle tonal separation instead of high-contrast gradients or glow-heavy effects.
  - Motion baseline (`180ms` reveal) with strict reduced-motion override.
  - Public landing page adds desktop-first `front-*` utilities for the editorial split layout, subtle decorative motion, and pointer-driven ambient background layers tuned down to match the darker restrained palette; there is no dedicated mobile-specific home layout.
  - Responsive workspace utilities (`workspace-shell`, `workspace-sidebar`, `workspace-header`, `workspace-content`, `workspace-mobile-nav`) that preserve hierarchy on smaller screens.
  - Shared page utilities (`page-card`, `page-list`, `page-list-row`, `page-toolbar`, `page-meta`) for low-chrome section and list composition.
  - Instruction-specific utilities (`instruction-map-*`, `instruction-node-*`, `instruction-markdown-preview`) render the visual section graph/editor without falling back to a single Markdown textarea.
- Shared utility: `src/lib/utils.ts` (`cn` helper)
- Shared protected route shell:
  - `src/components/layout/app-sidebar-shell.tsx`
  - Provides a fixed two-column workspace on desktop with a sticky left rail that keeps navigation/account actions visible while long pages scroll, plus an inline horizontal nav on narrower screens.
  - Keeps navigation limited to `Dashboard`, `Playbooks`, `Analytics`, `Instructions`, `Inbox`, `Teams`, `Profile`, and `Logout`, with reactive unread counts in nav/header inbox entry points.
  - Uses a plain product-workspace hierarchy rather than hero headers, floating rails, or decorative panels.
  - Logout is a regular document request (`href='/logout'`) so WorkOS sign-out always executes through the server handler.
- Mention input UI:
  - `src/components/mentions/mention-textarea.tsx`
  - Detects `@` mention triggers at the current textarea caret and queries `teams.searchTeamMembers` for inline IID mention insertion.
  - Picker styling now matches the restrained dark popover/form-control treatment used across the app.
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
- Instruction document schema + Angular baseline + Markdown serializer/parser: `src/features/instructions/document.ts`
- Instruction visual editor + topology preview: `src/features/instructions/editor.tsx`
  - Section editors render inside a single active panel with reduced border density, while the topology preview supports a compact mode used from the dedicated Preview section.
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
  - `convex/instructions.ts`
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
- `instructionDocuments`

### Core API Surface
- `users.getMe`, `users.upsertMe`, `users.updateProfile`
- `teams.createTeam`, `teams.listMyTeams`, `teams.listTeamMembers`, `teams.searchTeamMembers`, `teams.inviteByIID`, `teams.inviteByEmail`, `teams.createInviteLink`, `teams.listTeamInviteLinks`, `teams.acceptInviteToken`, `teams.revokeInviteLink`, `teams.listMyInvites`, `teams.respondInvite`, `teams.updateMemberRole`, `teams.removeMember`
- `posts.createPost`, `posts.updatePost`, `posts.resolvePost`, `posts.reopenPost`, `posts.archivePost`, `posts.unarchivePost`, `posts.listPosts`, `posts.findSimilar`, `posts.getPostDetail`
- `comments.createComment`, `comments.updateComment`, `comments.deleteComment`
- `playbooks.promoteFromPost`, `playbooks.listTeamPlaybooks`, `playbooks.getPlaybookDetail`
- `analytics.getTeamOverview`
- `instructions.listMyInstructions`, `instructions.getInstructionDetail`, `instructions.createInstruction`, `instructions.updateInstruction`, `instructions.replaceInstructionMarkdown`, `instructions.deleteInstruction`
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

### Instruction Document Notes
- `instructionDocuments` are user-owned and intentionally separate from team-scoped visibility rules.
- Canonical Markdown files use `schema: betterdoc-instruction/v1` frontmatter plus fixed top-level sections (`Overview`, `Code Structure`, `Code Patterns`, `Naming Patterns`, `Data Handling`, `Library Usage`, `Guardrails`, `Review Checklist`).
- Section nodes include `id`, `title`, `summary`, `paths`, `rules`, `examples`, and `relationships`, which allows BetterDoc to render the document as a structured map instead of a raw textarea.
- `instructions.createInstruction` seeds new documents from the Angular v21 reference baseline; `instructions.updateInstruction` regenerates Markdown from structured data; `instructions.replaceInstructionMarkdown` validates that externally generated Markdown still matches the canonical schema before accepting it.

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
