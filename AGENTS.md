# AGENTS.md instructions for /Users/michal/Documents/MyApps/BetterDoc

## Skills
### Available skills
- codebase-doc-sync: Keep BetterDoc docs synchronized with code changes. Use when work modifies application code, schema/API logic, auth/RBAC behavior, deployment configuration, CI pipelines, or environment setup. (file: /Users/michal/Documents/MyApps/BetterDoc/skills/codebase-doc-sync/SKILL.md)

### How to use skills
- Trigger rules:
  - If a task changes app code in this repository, use `codebase-doc-sync` in the same turn before finalizing.
  - If a task only changes docs/content and no code behavior, do not trigger `codebase-doc-sync`.
