import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { limits } from './model'

type DbLike = QueryCtx['db'] | MutationCtx['db']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const iidMentionPattern = new RegExp(
  `@(${escapeRegExp(limits.iidPrefix)}-[A-Z0-9]{${String(limits.iidRandomLength)}})\\b`,
  'gi',
)

export function parseIidMentions(value: string): string[] {
  const mentions = new Set<string>()

  for (const match of value.matchAll(iidMentionPattern)) {
    const iid = match[1]

    if (iid) {
      mentions.add(iid.toUpperCase())
    }
  }

  return [...mentions]
}

export function diffMentions(previousValue: string, nextValue: string): string[] {
  const previousMentions = new Set(parseIidMentions(previousValue))
  return parseIidMentions(nextValue).filter((iid) => !previousMentions.has(iid))
}

export async function resolveMentionRecipientUserIds(
  db: DbLike,
  teamId: Id<'teams'>,
  mentionIids: string[],
  actorUserId: Id<'users'>,
): Promise<Id<'users'>[]> {
  if (mentionIids.length === 0) {
    return []
  }

  const memberships = await db
    .query('teamMemberships')
    .withIndex('by_team', (query) => query.eq('teamId', teamId))
    .collect()

  const teamMemberIds = new Set(memberships.map((membership) => String(membership.userId)))

  const resolvedUsers = await Promise.all(
    mentionIids.map((iid) =>
      db
        .query('users')
        .withIndex('by_iid', (query) => query.eq('iid', iid))
        .unique(),
    ),
  )

  const recipients = new Set<Id<'users'>>()

  for (const user of resolvedUsers) {
    if (!user || user._id === actorUserId) {
      continue
    }

    if (!teamMemberIds.has(String(user._id))) {
      continue
    }

    recipients.add(user._id)
  }

  return [...recipients]
}

