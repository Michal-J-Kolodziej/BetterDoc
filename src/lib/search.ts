export type SearchStatus = 'active' | 'resolved' | 'archived' | 'all'

export type DashboardSearchQuery = {
  text: string
  team: string | null
  status: SearchStatus
  authorIid: string | null
  hasImage: boolean
  before: string | null
  after: string | null
  errors: string[]
}

const validDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function parseDashboardSearch(input: string): DashboardSearchQuery {
  const terms: string[] = []
  let team: string | null = null
  let status: SearchStatus = 'all'
  let authorIid: string | null = null
  let hasImage = false
  let before: string | null = null
  let after: string | null = null
  const errors: string[] = []

  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  for (const token of tokens) {
    const separatorIndex = token.indexOf(':')

    if (separatorIndex <= 0) {
      terms.push(token)
      continue
    }

    const key = token.slice(0, separatorIndex).toLowerCase()
    const rawValue = token.slice(separatorIndex + 1)

    if (!rawValue) {
      errors.push(`Missing value for qualifier "${key}:".`)
      continue
    }

    switch (key) {
      case 'team': {
        team = rawValue
        break
      }
      case 'status': {
        const normalized = rawValue.toLowerCase()

        if (
          normalized === 'active' ||
          normalized === 'resolved' ||
          normalized === 'archived' ||
          normalized === 'all'
        ) {
          status = normalized
        } else {
          errors.push('status must be active, resolved, archived, or all.')
        }
        break
      }
      case 'author': {
        authorIid = rawValue.toUpperCase()
        break
      }
      case 'has': {
        if (rawValue.toLowerCase() === 'image') {
          hasImage = true
        } else {
          errors.push('has only supports has:image.')
        }
        break
      }
      case 'before': {
        if (validDatePattern.test(rawValue)) {
          before = rawValue
        } else {
          errors.push('before must use YYYY-MM-DD.')
        }
        break
      }
      case 'after': {
        if (validDatePattern.test(rawValue)) {
          after = rawValue
        } else {
          errors.push('after must use YYYY-MM-DD.')
        }
        break
      }
      default: {
        terms.push(token)
      }
    }
  }

  return {
    text: terms.join(' ').trim(),
    team,
    status,
    authorIid,
    hasImage,
    before,
    after,
    errors,
  }
}

export function stringifySearchQuery(query: DashboardSearchQuery): string {
  const parts: string[] = []

  if (query.text) {
    parts.push(query.text)
  }

  if (query.team) {
    parts.push(`team:${query.team}`)
  }

  if (query.status !== 'all') {
    parts.push(`status:${query.status}`)
  }

  if (query.authorIid) {
    parts.push(`author:${query.authorIid}`)
  }

  if (query.hasImage) {
    parts.push('has:image')
  }

  if (query.before) {
    parts.push(`before:${query.before}`)
  }

  if (query.after) {
    parts.push(`after:${query.after}`)
  }

  return parts.join(' ')
}
