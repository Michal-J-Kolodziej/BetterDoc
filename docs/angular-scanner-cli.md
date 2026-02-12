# BetterDoc Angular Scanner CLI (BD-010)

Last updated: 2026-02-12

## Purpose
- Produce a deterministic Angular workspace metadata snapshot for downstream ingestion.
- Extracts project, library, component, and internal dependency metadata from an Angular repo.

## CLI usage
- Show help:
  - `bun run scan:angular -- --help`
- Scan the current directory:
  - `bun run scan:angular --`
- Scan a specific workspace path:
  - `bun run scan:angular -- --workspace /path/to/angular-repo`
- Scan and write to a file:
  - `bun run scan:angular -- --workspace /path/to/angular-repo --output ./scan-output.json`

## Input expectations
- Workspace root must contain `angular.json` or `workspace.json`.
- Project definitions are read from:
  - inline `projects` entries in the workspace file, or
  - `project.json` files referenced from string project entries.
- Optional TS path alias resolution reads `tsconfig.base.json` and `tsconfig.json`.

## Output schema (sample)

```json
{
  "schemaVersion": 1,
  "workspaceConfigPath": "angular.json",
  "projects": [
    {
      "name": "portal",
      "type": "application",
      "rootPath": "apps/portal",
      "sourceRootPath": "apps/portal/src",
      "configFilePath": "angular.json",
      "dependencies": ["shared-utils", "ui-kit"]
    }
  ],
  "libs": [
    {
      "name": "shared-utils",
      "rootPath": "libs/shared-utils",
      "sourceRootPath": "libs/shared-utils/src",
      "configFilePath": "angular.json"
    }
  ],
  "components": [
    {
      "name": "AppComponent",
      "className": "AppComponent",
      "selector": "bd-root",
      "standalone": true,
      "project": "portal",
      "filePath": "apps/portal/src/app/app.component.ts",
      "dependencies": ["shared-utils", "ui-kit"]
    }
  ],
  "dependencies": [
    {
      "sourceProject": "portal",
      "targetProject": "shared-utils",
      "viaFiles": [
        "apps/portal/src/app/app.component.ts",
        "apps/portal/src/main.ts"
      ]
    }
  ]
}
```

## Deterministic output guarantees
- Projects, libraries, components, and dependency edges are sorted.
- File traversal uses sorted directory and file names.
- Dependency lists and `viaFiles` lists are sorted and de-duplicated.
- Output does not include runtime timestamps.

## Error reporting
- CLI reports scanner errors with explicit codes:
  - `WORKSPACE_NOT_FOUND`
  - `WORKSPACE_PARSE_ERROR`
  - `WORKSPACE_PROJECTS_INVALID`
  - `PROJECT_CONFIG_NOT_FOUND`
  - `PROJECT_CONFIG_PARSE_ERROR`
  - `PROJECT_CONFIG_INVALID`
  - `INVALID_PATH`
- Error output format:
  - `[angular-scanner:<CODE>] <message>`
  - Optional JSON details payload when available.
