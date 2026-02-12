import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

import {
  AngularScannerError,
  scanAngularWorkspace,
  writeAngularScanSnapshot,
} from '../src/lib/angular-scanner'

type CliOptions = {
  workspaceRoot: string
  outputPath: string | null
}

const usage = `BetterDoc Angular scanner (BD-010)

Usage:
  bun run scan:angular -- [workspace]
  bun run scan:angular -- --workspace <path>
  bun run scan:angular -- --workspace <path> --output <file>

Options:
  -w, --workspace <path>   Angular workspace root (default: current directory)
  -o, --output <file>      Write JSON output to file instead of stdout
  -h, --help               Show this help message
`

export async function runAngularScannerCli(args: string[]): Promise<number> {
  const options = parseCliArgs(args)

  if (options === 'help') {
    process.stdout.write(usage)
    return 0
  }

  const snapshot = await scanAngularWorkspace(options.workspaceRoot)

  if (options.outputPath) {
    await writeAngularScanSnapshot(options.outputPath, snapshot)
    process.stderr.write(
      `[angular-scanner] Snapshot written to ${path.resolve(options.outputPath)}\n`,
    )
    return 0
  }

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`)
  return 0
}

function parseCliArgs(args: string[]): CliOptions | 'help' {
  let workspaceRoot = process.cwd()
  let outputPath: string | null = null

  const tokens = [...args]

  while (tokens.length > 0) {
    const token = tokens.shift()

    if (!token) {
      break
    }

    if (token === '-h' || token === '--help') {
      return 'help'
    }

    if (token === '-w' || token === '--workspace') {
      const nextToken = tokens.shift()
      if (!nextToken || nextToken.startsWith('-')) {
        throw new AngularScannerError(
          'INVALID_PATH',
          `Missing value for ${token}.`,
        )
      }

      workspaceRoot = nextToken
      continue
    }

    if (token === '-o' || token === '--output') {
      const nextToken = tokens.shift()
      if (!nextToken || nextToken.startsWith('-')) {
        throw new AngularScannerError(
          'INVALID_PATH',
          `Missing value for ${token}.`,
        )
      }

      outputPath = nextToken
      continue
    }

    if (token.startsWith('-')) {
      throw new AngularScannerError(
        'INVALID_PATH',
        `Unknown argument: ${token}`,
      )
    }

    workspaceRoot = token
  }

  return {
    workspaceRoot,
    outputPath,
  }
}

async function main(): Promise<void> {
  try {
    const exitCode = await runAngularScannerCli(process.argv.slice(2))
    process.exitCode = exitCode
  } catch (error) {
    reportCliError(error)
  }
}

function reportCliError(error: unknown): never {
  if (error instanceof AngularScannerError) {
    process.stderr.write(`[angular-scanner:${error.code}] ${error.message}\n`)

    if (Object.keys(error.details).length > 0) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`)
    }

    process.stderr.write('Use --help to view CLI usage.\n')
    process.exit(1)
  }

  if (error instanceof Error) {
    process.stderr.write(`[angular-scanner:UNEXPECTED] ${error.message}\n`)
    process.exit(1)
  }

  process.stderr.write('[angular-scanner:UNEXPECTED] Unknown error\n')
  process.exit(1)
}

const currentFilePath = fileURLToPath(import.meta.url)
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (entryFilePath === currentFilePath) {
  void main()
}
