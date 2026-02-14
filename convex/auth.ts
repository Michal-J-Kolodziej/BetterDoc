import { ConvexError } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { TeamRole } from './model'

type DbLike = QueryCtx['db'] | MutationCtx['db']

export function isManagerRole(role: TeamRole): boolean {
  return role === 'admin' || role === 'teamleader'
}

export function canAssignRole(actorRole: TeamRole, nextRole: TeamRole): boolean {
  if (actorRole === 'admin') {
    return true
  }

  if (actorRole === 'teamleader') {
    return nextRole !== 'admin'
  }

  return false
}

export function canManageMember(actorRole: TeamRole, targetRole: TeamRole): boolean {
  if (actorRole === 'admin') {
    return true
  }

  if (actorRole === 'teamleader') {
    return targetRole !== 'admin'
  }

  return false
}

export async function getUserByWorkosUserId(
  db: DbLike,
  workosUserId: string,
): Promise<Doc<'users'> | null> {
  return db
    .query('users')
    .withIndex('by_workos_user_id', (query) => query.eq('workosUserId', workosUserId))
    .unique()
}

export async function requireUserByWorkosUserId(
  db: DbLike,
  workosUserId: string,
): Promise<Doc<'users'>> {
  const user = await getUserByWorkosUserId(db, workosUserId)

  if (!user) {
    throw new ConvexError('User profile not initialized. Refresh and try again.')
  }

  return user
}

export async function getMembership(
  db: DbLike,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
): Promise<Doc<'teamMemberships'> | null> {
  return db
    .query('teamMemberships')
    .withIndex('by_team_user', (query) => query.eq('teamId', teamId).eq('userId', userId))
    .unique()
}

export async function requireMembership(
  db: DbLike,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
): Promise<Doc<'teamMemberships'>> {
  const membership = await getMembership(db, teamId, userId)

  if (!membership) {
    throw new ConvexError('You are not a member of this team.')
  }

  return membership
}

export function canArchiveOrUnarchive(
  actorUserId: Id<'users'>,
  actorRole: TeamRole,
  createdByUserId: Id<'users'>,
): boolean {
  return actorUserId === createdByUserId || actorRole === 'admin' || actorRole === 'teamleader'
}

export function canDeleteComment(
  actorUserId: Id<'users'>,
  actorRole: TeamRole,
  commentAuthorId: Id<'users'>,
): boolean {
  return actorUserId === commentAuthorId || actorRole === 'admin' || actorRole === 'teamleader'
}

export async function ensureTeamExists(
  db: DbLike,
  teamId: Id<'teams'>,
): Promise<Doc<'teams'>> {
  const team = await db.get(teamId)

  if (!team) {
    throw new ConvexError('Team not found.')
  }

  return team
}
