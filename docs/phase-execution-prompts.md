# BetterDoc Phase Execution Prompts

## Global Rules (apply to every phase)
- Repo: `/Users/michal/Documents/MyApps/BetterDoc`
- Stack: TanStack Start + React/TS + Convex + WorkOS + Bun.
- Locked decisions:
  1. Email invites are **not** domain-restricted.
  2. Templates can be created/edited by **all team members**.
  3. Playbooks are **team-private**.
  4. Archived posts are **not** treated as resolved.
- Keep current coding style and existing auth/membership boundaries.
- Run the `codebase-doc-sync` skill before finalizing because code is changing.
- Run quality gates relevant to changed scope (`bun run lint`, `bun run typecheck`, tests for touched modules).
- Return:
  1. Changed files (with purpose),
  2. Implemented API contracts,
  3. Acceptance criteria checklist,
  4. Test results,
  5. Any risks/follow-ups.

---

## Phase 1 Prompt (BD-201, BD-202)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 1 tickets BD-201 and BD-202.

Scope:
- Add schema/index foundation for:
  - postTemplates
  - postDrafts
  - commentDrafts
  - notifications
- Add notification service primitives:
  - notifications.enqueue (idempotent by dedupeKey)
  - notifications.enqueueMany
- Hook initial events:
  - teams.inviteByIID => invite_received notification
  - comments.createComment => notify post creator when actor != creator

Acceptance criteria:
1) New tables + indexes exist and are query-efficient for team/user/time access patterns.
2) Drafts have expiresAt and default retention behavior.
3) enqueue is idempotent by dedupeKey.
4) Initial invite/comment notification hooks fire exactly once per event.
5) Existing post/team/comment flows remain unchanged.

Deliverables:
- Updated schema + Convex functions + tests.
- Short note describing dedupe strategy and failure behavior.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Phase 2 Prompt (BD-203, BD-204)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 2 tickets BD-203 and BD-204.

Scope:
- Team templates (all members can CRUD):
  - templates.listTeamTemplates
  - templates.createTemplate
  - templates.updateTemplate
  - templates.deleteTemplate
- Dashboard create-post dialog:
  - apply template to fields
  - save current form as template
- Draft autosave + restore:
  - drafts.upsert/get/delete for post drafts
  - drafts.upsert/get/delete for comment drafts
  - autosave debounce: 1500ms
  - restore on reopen; clear on successful submit
  - discard draft action

Acceptance criteria:
1) Team member can CRUD templates in their team.
2) Template picker applies all fields correctly.
3) Post/comment drafts autosave and restore after refresh.
4) Submit clears corresponding draft.
5) Access control prevents cross-user draft reads.

Deliverables:
- API contracts implemented end-to-end.
- UI integrated in dashboard/post flows.
- Tests for membership enforcement + autosave lifecycle.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Phase 3 Prompt (BD-205, BD-206)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 3 tickets BD-205 and BD-206.

Scope:
- Similar incidents API:
  - posts.findSimilar
  - deterministic ranking
  - same-team membership enforcement
  - support excludePostId
- Scoring:
  - token overlap (Jaccard-like) + recency boost
  - default limit 5, max 10
  - return score + reasons
- Composer UI:
  - debounced call (350ms)
  - show panel once combined input >= 20 chars
  - "Possible duplicate" warning when top score >= 0.65
  - links to post detail
  - never block create

Acceptance criteria:
1) Similar results are deterministic for same input.
2) API respects team boundaries and excludePostId.
3) UI appears/disappears by input threshold.
4) Warning threshold behavior is correct.
5) Compose/create remains fully functional.

Deliverables:
- Backend function + UI panel + tests (ranking/membership/threshold behaviors).
- Basic performance notes for expected dataset size.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Phase 4 Prompt (BD-207, BD-208)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 4 tickets BD-207 and BD-208.

Scope:
- Mentions:
  - parse IID mentions in post description/comment body (`@BD-XXXXXXXX`)
  - notify only newly added mentions on create/update
  - skip self-notifications
  - ignore/validate non-team mentions
  - add teams.searchTeamMembers for mention picker
- In-app inbox:
  - notifications.getUnreadCount
  - notifications.listInbox (cursor pagination)
  - notifications.markRead
  - notifications.markAllRead
- UI:
  - unread badge in header areas
  - /inbox route with list + deep links + mark read controls
  - opening a notification link marks it read

Acceptance criteria:
1) Mention picker works from `@` trigger.
2) Mention notifications are deduped per entity+recipient.
3) Unread badge and inbox counts stay consistent.
4) Mark-read and mark-all-read are idempotent.
5) Pagination has no duplicates or missing items.

Deliverables:
- Mention + notification pipeline and inbox UI.
- Tests for mention parsing/dedupe/read-state transitions.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Phase 5 Prompt (BD-209, BD-210)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 5 tickets BD-209 and BD-210.

Scope:
- Backend invite expansion:
  - teams.inviteByEmail
  - teams.createInviteLink
  - teams.acceptInviteToken
  - teams.revokeInviteLink
- Data model:
  - teamEmailInvites
  - teamInviteLinks (store hashed token only)
  - optional user email field needed for email-bound acceptance
- Invite defaults:
  - expiry: 14 days
  - link max uses: 25
- Existing IID invite flow must remain intact.
- Teams UI:
  - add Email and Link methods
  - copyable URLs
  - list active links + revoke action
  - join route flow for token acceptance

Acceptance criteria:
1) teamleader/admin can create email and link invites.
2) Email invite acceptance requires logged-in email match.
3) Link invite enforces expiry/maxUses/revoked state.
4) Plain token is only visible at creation time.
5) IID invite flow remains unchanged.

Deliverables:
- Backend contracts + teams UI integration + tests.
- Security notes for token hashing and replay/idempotency behavior.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Phase 6 Prompt (BD-211, BD-212)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Implement Phase 6 tickets BD-211 and BD-212.

Scope:
- Post lifecycle extension:
  - add `resolved` status
  - posts.resolvePost (requires resolutionSummary)
  - posts.reopenPost
- Playbooks:
  - playbooks.promoteFromPost (teamleader/admin only)
  - playbooks.listTeamPlaybooks
  - playbooks.getPlaybookDetail
  - team-private visibility only
- Analytics route + API:
  - analytics.getTeamOverview
  - rangeDays = 30 | 90
  - separate resolved vs archived metrics
  - unresolved open count
  - median time-to-resolution (resolved only)
  - recurring topics and top contributors

Acceptance criteria:
1) Resolve/reopen actions obey role/status rules.
2) Resolved posts become read-only for edits/comments until reopened.
3) Promote to playbook is available only for eligible roles and resolved posts.
4) Analytics displays resolved and archived separately.
5) Team boundary enforcement holds for playbooks and analytics.

Deliverables:
- Status migration-safe updates + API + UI.
- Tests for permissions, status transitions, analytics correctness.
- Run codebase-doc-sync and update docs accordingly.
```

---

## Optional Combined Prompt (all phases in order)

```txt
Work in /Users/michal/Documents/MyApps/BetterDoc.

Execute phases in order:
1) BD-201, BD-202
2) BD-203, BD-204
3) BD-205, BD-206
4) BD-207, BD-208
5) BD-209, BD-210
6) BD-211, BD-212

For each phase:
- Implement only that phase's scope.
- Run relevant tests and quality checks.
- Run codebase-doc-sync and docs updates.
- Return changed files + API contracts + acceptance checklist + risks before moving to the next phase.
```
