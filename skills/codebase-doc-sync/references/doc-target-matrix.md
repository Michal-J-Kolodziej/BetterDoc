# Documentation Target Matrix

Use this matrix when deciding what to update after code changes.

| Code Change Type | Primary Doc Target | Secondary Doc Target |
|---|---|---|
| TanStack routes/pages/components | `docs/codebase-reference.md` | `docs/change-log.md` |
| Convex schema, queries, mutations, actions | `docs/codebase-reference.md` | `docs/change-log.md` |
| WorkOS auth/session/RBAC | `docs/security-and-access.md` | `docs/change-log.md` |
| Azure Pipelines and scan integration | `docs/operations.md` | `docs/change-log.md` |
| Vercel deployment/environment changes | `docs/operations.md` | `docs/change-log.md` |
| New product behavior/features | Existing feature doc in `docs/` or `docs/codebase-reference.md` | `docs/change-log.md` |

If a target file does not exist, create it with concise sections and continue.
