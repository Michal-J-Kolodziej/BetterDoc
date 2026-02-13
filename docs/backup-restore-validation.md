# BetterDoc Backup/Restore Validation Drill (BD-017)

Last updated: 2026-02-13

## Goal
- Verify BetterDoc data can be exported from production Convex and restored into a non-production deployment.
- Validate core product paths after restore: tip search, component explorer, and watch notifications.

## Backup command
Run from repository root:

```bash
bunx convex export --prod --path ./artifacts/backups/prod-convex-backup.zip --include-file-storage
```

Expected result:
- A ZIP archive is created at `./artifacts/backups/prod-convex-backup.zip`.

## Restore drill target
- Use a staging or preview deployment only.
- Never run restore validation directly against production.

## Restore command (staging example)
```bash
bunx convex import --deployment-name "$VITE_CONVEX_DEPLOYMENT_STAGING" --replace-all --yes ./artifacts/backups/prod-convex-backup.zip
```

## Validation checklist
1. Load dashboard:
   - Tip list returns expected records.
2. Search checks:
   - Search by text/tag returns expected rows.
3. Explorer checks:
   - Workspace/project/component pages resolve.
4. Notification checks:
   - Watchlist subscriptions are present.
   - Notification history can be queried and marked read.
5. API checks:
   - `scanIngestion.getLatestSuccessfulScanRun` returns latest successful ingest metadata.

## Recovery acceptance criteria
- Restore completes without CLI errors.
- Core read paths work in restored deployment.
- No schema mismatch or missing-table errors in logs.

## Drill cadence
- Run at least once per release candidate cycle.
- Record drill date, operator, and outcome in `docs/change-log.md`.
