---
name: codebase-doc-sync
description: Keep BetterDoc documentation synchronized with code changes. Use when tasks add, modify, or remove application code, schemas, APIs, auth/RBAC logic, deployment config, CI pipelines, or environment setup. Run in the same turn after implementing code changes so docs stay accurate.
---

# Codebase Doc Sync

## Goal

Keep repository documentation accurate whenever the BetterDoc codebase changes.

## Workflow

1. Detect changed scope
- Inspect modified, staged, and untracked files with git.
- If git metadata is unavailable, use files changed in the current task context.
- If only documentation files changed, skip updates and report that no code-to-doc sync was needed.

2. Map code changes to documentation targets
- Frontend routes, UI state, components: update `docs/codebase-reference.md` UI sections.
- Convex schema/functions, data relationships: update `docs/codebase-reference.md` data/API sections.
- WorkOS auth, session, RBAC policy: update `docs/security-and-access.md`.
- Vercel deployment, Azure pipelines, env vars, operational flows: update `docs/operations.md`.
- Feature behavior changes: update an existing feature doc under `docs/` or add a concise section to `docs/codebase-reference.md`.

3. Apply documentation updates
- Prefer editing existing docs instead of creating many new files.
- Create missing target docs only when needed to avoid undocumented code areas.
- Document current behavior and constraints, not plans.
- Include concrete paths, commands, env vars, and ownership notes when relevant.

4. Record change summary
- Append an entry to `docs/change-log.md` with:
  - Date
  - Code paths changed
  - Docs updated
  - Short note on user-visible or operational impact

5. Verify quality
- Ensure every meaningful code change is reflected in docs or explicitly called out as intentionally omitted.
- Remove stale statements introduced by refactors.
- Keep docs concise and implementation-focused.

## Output Requirements

- In the final response, list the documentation files updated and why.
- If no documentation updates were needed, state the reason explicitly.

## Guardrails

- Do not invent behavior not present in code.
- Do not delete historical entries from `docs/change-log.md`.
- Preserve sensitive details handling; never expose secrets in docs.
