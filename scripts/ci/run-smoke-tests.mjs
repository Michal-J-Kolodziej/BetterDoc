#!/usr/bin/env node

import process from 'node:process'

const HELP_TEXT = `BetterDoc HTTP smoke checks

Usage:
  node scripts/ci/run-smoke-tests.mjs --base-url <url>

Options:
  --base-url <url>     Base URL to test (for example https://my-preview.vercel.app)
  --help               Show help
`

function parseArgs(argv) {
  const args = [...argv]
  let baseUrlText = null

  while (args.length > 0) {
    const token = args.shift()
    if (!token) {
      break
    }

    if (token === '--help' || token === '-h') {
      return 'help'
    }

    if (token === '--base-url') {
      const value = args.shift()
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --base-url.')
      }

      baseUrlText = value
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (!baseUrlText) {
    throw new Error('--base-url is required.')
  }

  const baseUrl = new URL(baseUrlText)
  if (!baseUrl.protocol.startsWith('http')) {
    throw new Error('--base-url must start with http:// or https://')
  }

  if (baseUrl.pathname.length > 1) {
    baseUrl.pathname = ''
  }

  baseUrl.search = ''
  baseUrl.hash = ''

  return { baseUrl }
}

function assertRedirectStatus(status) {
  if (![301, 302, 303, 307, 308].includes(status)) {
    throw new Error(`Expected redirect status, received HTTP ${status}.`)
  }
}

async function fetchPath(baseUrl, path) {
  const url = new URL(path, baseUrl).toString()
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'betterdoc-smoke-check/1.0',
    },
  })

  return {
    status: response.status,
    body: await response.text(),
    location: response.headers.get('location'),
  }
}

const checks = [
  {
    name: 'Home page responds with BetterDoc shell',
    path: '/',
    validate: ({ status, body }) => {
      if (status !== 200) {
        throw new Error(`Expected HTTP 200, received ${status}.`)
      }

      if (!body.includes('BetterDoc')) {
        throw new Error('Response body did not include "BetterDoc".')
      }
    },
  },
  {
    name: 'Login route redirects to identity provider',
    path: '/login',
    validate: ({ status, location }) => {
      assertRedirectStatus(status)

      if (!location) {
        throw new Error('Expected redirect location header.')
      }
    },
  },
  {
    name: 'Dashboard route enforces auth redirect when unauthenticated',
    path: '/dashboard',
    validate: ({ status, location }) => {
      assertRedirectStatus(status)

      if (!location) {
        throw new Error('Expected redirect location header.')
      }
    },
  },
  {
    name: 'Explorer route returns application shell',
    path: '/explorer',
    validate: ({ status, body }) => {
      if (status !== 200) {
        throw new Error(`Expected HTTP 200, received ${status}.`)
      }

      if (!body.includes('Component Explorer')) {
        throw new Error(
          'Explorer response did not include expected "Component Explorer" text.',
        )
      }
    },
  },
]

async function run() {
  const parsedArgs = parseArgs(process.argv.slice(2))

  if (parsedArgs === 'help') {
    process.stdout.write(HELP_TEXT)
    return
  }

  process.stdout.write(
    `[smoke] Running ${String(checks.length)} checks against ${parsedArgs.baseUrl.toString()}.\n`,
  )

  for (const check of checks) {
    const result = await fetchPath(parsedArgs.baseUrl, check.path)
    check.validate(result)
    process.stdout.write(`[smoke] PASS ${check.name}\n`)
  }

  process.stdout.write('[smoke] All checks passed.\n')
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[smoke] FAIL ${message}\n`)
  process.exit(1)
})
