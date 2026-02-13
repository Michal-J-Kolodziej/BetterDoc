import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

type SyncSource = 'manual' | 'pipeline' | 'scheduled'

type CliOptions = {
  repoUrl: string
  workspaceId: string
  branch: string
  workspaceSubpath: string | null
  cloneDir: string | null
  keepClone: boolean
  ingestUrl: string
  source: SyncSource
  idempotencyKey: string | null
  scannerVersion: string
  pat: string | null
}

const usage = `BetterDoc manual Azure repo sync

Clone an Azure repo locally, run the Angular scanner, and post the snapshot to Convex.

Usage:
  bun run sync:azure-repo -- --repo-url <url> --workspace-id <id> [options]

Required:
  --repo-url <url>          Azure repo clone URL
  --workspace-id <id>       Stable workspace id used by BetterDoc graph ingestion

Options:
  --branch <name>           Git branch to clone (default: main)
  --workspace-subpath <p>   Relative path to Angular workspace inside the repo
  --clone-dir <path>        Directory to clone into (default: temporary directory)
  --keep-clone              Keep clone directory after sync
  --ingest-url <url>        Convex ingestion URL (default: CONVEX_INGEST_URL env var)
  --source <type>           Ingestion source: manual|pipeline|scheduled (default: manual)
  --idempotency-key <key>   Override idempotency key
  --scanner-version <ver>   Scanner version metadata (default: manual-sync)
  --pat <token>             Azure DevOps PAT for private repos (default: AZURE_DEVOPS_PAT env var)
  -h, --help                Show help
`

function parseCliArgs(args: string[]): CliOptions | 'help' {
  let repoUrl: string | null = null
  let workspaceId: string | null = null
  let branch = 'main'
  let workspaceSubpath: string | null = null
  let cloneDir: string | null = null
  let keepClone = false
  let ingestUrl = process.env.CONVEX_INGEST_URL?.trim() ?? ''
  let source: SyncSource = 'manual'
  let idempotencyKey: string | null = null
  let scannerVersion = 'manual-sync'
  let pat = process.env.AZURE_DEVOPS_PAT?.trim() || null

  const tokens = [...args]

  while (tokens.length > 0) {
    const token = tokens.shift()
    if (!token) {
      break
    }

    if (token === '--help' || token === '-h') {
      return 'help'
    }

    if (token === '--keep-clone') {
      keepClone = true
      continue
    }

    if (token === '--repo-url') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --repo-url.')
      }
      repoUrl = value
      continue
    }

    if (token === '--workspace-id') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --workspace-id.')
      }
      workspaceId = value
      continue
    }

    if (token === '--branch') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --branch.')
      }
      branch = value
      continue
    }

    if (token === '--clone-dir') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --clone-dir.')
      }
      cloneDir = value
      continue
    }

    if (token === '--workspace-subpath') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --workspace-subpath.')
      }
      workspaceSubpath = value
      continue
    }

    if (token === '--ingest-url') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --ingest-url.')
      }
      ingestUrl = value
      continue
    }

    if (token === '--source') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --source.')
      }

      if (value !== 'manual' && value !== 'pipeline' && value !== 'scheduled') {
        throw new Error('--source must be manual, pipeline, or scheduled.')
      }

      source = value
      continue
    }

    if (token === '--idempotency-key') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --idempotency-key.')
      }
      idempotencyKey = value
      continue
    }

    if (token === '--scanner-version') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --scanner-version.')
      }
      scannerVersion = value
      continue
    }

    if (token === '--pat') {
      const value = tokens.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --pat.')
      }
      pat = value
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (!repoUrl) {
    throw new Error('--repo-url is required.')
  }

  if (!workspaceId) {
    throw new Error('--workspace-id is required.')
  }

  if (!ingestUrl) {
    throw new Error(
      '--ingest-url is required (or set CONVEX_INGEST_URL in your environment).',
    )
  }

  return {
    repoUrl,
    workspaceId,
    branch,
    workspaceSubpath,
    cloneDir,
    keepClone,
    ingestUrl,
    source,
    idempotencyKey,
    scannerVersion,
    pat,
  }
}

function sanitizeKey(input: string): string {
  return input.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 128)
}

function buildDefaultIdempotencyKey(workspaceId: string): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return sanitizeKey(`manual-sync-${workspaceId}-${timestamp}-${randomSuffix}`)
}

type NormalizedIngestUrl = {
  value: string
  convertedCloudHost: boolean
  defaultedScannerPath: boolean
}

function normalizeIngestUrl(rawUrl: string): NormalizedIngestUrl {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error(`Invalid --ingest-url value: "${rawUrl}".`)
  }

  const normalized = new URL(parsedUrl.toString())
  let convertedCloudHost = false
  let defaultedScannerPath = false

  if (normalized.hostname.endsWith('.convex.cloud')) {
    normalized.hostname = normalized.hostname.replace(
      /\.convex\.cloud$/,
      '.convex.site',
    )
    convertedCloudHost = true
  }

  if (normalized.pathname === '/' || normalized.pathname.length === 0) {
    normalized.pathname = '/scanner/ingest'
    defaultedScannerPath = true
  }

  return {
    value: normalized.toString(),
    convertedCloudHost,
    defaultedScannerPath,
  }
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd,
      env: options.env,
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(' ')} (exit code ${String(code)})`,
        ),
      )
    })
  })
}

function runCommandWithOutput(
  command: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'inherit'],
      cwd: options.cwd,
      env: options.env,
    })

    let output = ''

    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
        return
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(' ')} (exit code ${String(code)})`,
        ),
      )
    })
  })
}

async function runSync(options: CliOptions): Promise<void> {
  const baseCloneDir = options.cloneDir
    ? path.resolve(options.cloneDir)
    : await mkdtemp(path.join(tmpdir(), 'betterdoc-sync-'))
  const snapshotPath = path.join(baseCloneDir, 'scan-snapshot.json')
  const shouldCleanup = !options.keepClone && !options.cloneDir

  try {
    process.stdout.write(
      `[manual-sync] Cloning ${options.repoUrl} (${options.branch}) into ${baseCloneDir}\n`,
    )

    const cloneArgs = ['clone', '--depth', '1', '--branch', options.branch]
    const cloneEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    }

    if (options.pat) {
      cloneEnv.GIT_CONFIG_COUNT = '1'
      cloneEnv.GIT_CONFIG_KEY_0 = 'http.extraheader'
      cloneEnv.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${Buffer.from(`:${options.pat}`).toString('base64')}`
    }
    cloneArgs.push(options.repoUrl, baseCloneDir)

    await runCommand('git', cloneArgs, {
      env: cloneEnv,
    })

    const workspaceRoot = await resolveAngularWorkspaceRoot(
      baseCloneDir,
      options.workspaceSubpath,
    )

    process.stdout.write(
      `[manual-sync] Running Angular scanner in ${workspaceRoot}...\n`,
    )
    await runCommand('bun', [
      'run',
      'scan:angular',
      '--',
      '--workspace',
      workspaceRoot,
      '--output',
      snapshotPath,
    ])

    const commitSha = (
      await runCommandWithOutput('git', ['-C', baseCloneDir, 'rev-parse', 'HEAD'])
    ).trim()

    const idempotencyKey =
      options.idempotencyKey ?? buildDefaultIdempotencyKey(options.workspaceId)
    const normalizedIngestUrl = normalizeIngestUrl(options.ingestUrl)

    if (normalizedIngestUrl.convertedCloudHost) {
      process.stdout.write(
        '[manual-sync] Ingest URL host normalized from convex.cloud to convex.site for HTTP action routing.\n',
      )
    }

    if (normalizedIngestUrl.defaultedScannerPath) {
      process.stdout.write(
        '[manual-sync] Ingest URL path defaulted to /scanner/ingest.\n',
      )
    }

    process.stdout.write('[manual-sync] Posting scanner payload to Convex...\n')
    await runCommand('bun', ['run', 'scripts/ci/post-scan-ingestion.ts'], {
      env: {
        ...process.env,
        CONVEX_INGEST_URL: normalizedIngestUrl.value,
        SCAN_SNAPSHOT_FILE: snapshotPath,
        SCAN_WORKSPACE_ID: options.workspaceId,
        SCANNER_NAME: 'angular-scanner',
        SCANNER_VERSION: options.scannerVersion,
        INGEST_SOURCE: options.source,
        INGEST_IDEMPOTENCY_KEY: idempotencyKey,
        INGEST_BRANCH: options.branch,
        INGEST_COMMIT_SHA: commitSha,
        INGEST_RUN_ID: `manual-sync-${Date.now().toString()}`,
      },
    })

    process.stdout.write('[manual-sync] Sync completed successfully.\n')
    process.stdout.write(`[manual-sync] Snapshot file: ${snapshotPath}\n`)
    process.stdout.write(`[manual-sync] Workspace ID: ${options.workspaceId}\n`)
  } finally {
    if (shouldCleanup) {
      await rm(baseCloneDir, { recursive: true, force: true })
      process.stdout.write(
        `[manual-sync] Cleaned up temporary clone directory: ${baseCloneDir}\n`,
      )
    }
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath)
    return true
  } catch {
    return false
  }
}

async function hasAngularWorkspaceConfig(rootPath: string): Promise<boolean> {
  const [hasAngularJson, hasWorkspaceJson] = await Promise.all([
    pathExists(path.join(rootPath, 'angular.json')),
    pathExists(path.join(rootPath, 'workspace.json')),
  ])

  return hasAngularJson || hasWorkspaceJson
}

async function resolveAngularWorkspaceRoot(
  cloneRoot: string,
  workspaceSubpath: string | null,
): Promise<string> {
  if (workspaceSubpath) {
    const candidate = path.resolve(cloneRoot, workspaceSubpath)
    if (!(await hasAngularWorkspaceConfig(candidate))) {
      throw new Error(
        `Workspace subpath "${workspaceSubpath}" does not contain angular.json or workspace.json.`,
      )
    }

    return candidate
  }

  if (await hasAngularWorkspaceConfig(cloneRoot)) {
    return cloneRoot
  }

  const listedFiles = await runCommandWithOutput(
    'git',
    [
      '-C',
      cloneRoot,
      'ls-files',
      '**/angular.json',
      '**/workspace.json',
    ],
  )

  const workspaceDirs = [...new Set(
    listedFiles
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((relativePath) => path.dirname(relativePath))
      .map((dir) => (dir === '.' ? '' : dir)),
  )]

  if (workspaceDirs.length === 0) {
    throw new Error(
      `Could not find angular.json or workspace.json in cloned repo. Provide --workspace-subpath if needed.`,
    )
  }

  if (workspaceDirs.length === 1) {
    const detectedRoot = path.resolve(cloneRoot, workspaceDirs[0])
    process.stdout.write(
      `[manual-sync] Auto-detected Angular workspace at ${detectedRoot}\n`,
    )
    return detectedRoot
  }

  const preview = workspaceDirs
    .slice(0, 10)
    .map((dir) => (dir.length > 0 ? dir : '.'))
    .join(', ')

  throw new Error(
    `Multiple Angular workspaces detected (${workspaceDirs.length}). Re-run with --workspace-subpath. Candidates: ${preview}`,
  )
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2))
  if (parsed === 'help') {
    process.stdout.write(usage)
    return
  }

  await runSync(parsed)
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[manual-sync] ${message}\n`)
  process.exit(1)
})
