import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { getUserByWorkosUserId } from './auth'
import { limits, normalizeText, teamRoleValidator } from './model'

type CtxLike = Pick<QueryCtx, 'db' | 'storage'> | Pick<MutationCtx, 'db' | 'storage'>

type TeamSummary = {
  teamId: Id<'teams'>
  name: string
  slug: string
  role: Doc<'teamMemberships'>['role']
}

type ProfileView = {
  userId: Id<'users'>
  workosUserId: string
  iid: string
  name: string
  avatarStorageId: Id<'_storage'> | null
  avatarUrl: string | null
  teams: TeamSummary[]
}

const profileViewValidator = v.object({
  userId: v.id('users'),
  workosUserId: v.string(),
  iid: v.string(),
  name: v.string(),
  avatarStorageId: v.union(v.id('_storage'), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  teams: v.array(
    v.object({
      teamId: v.id('teams'),
      name: v.string(),
      slug: v.string(),
      role: teamRoleValidator,
    }),
  ),
})

function normalizeName(name: string): string {
  const normalized = normalizeText(name)

  if (!normalized) {
    throw new ConvexError('Name is required.')
  }

  if (normalized.length > limits.maxNameLength) {
    throw new ConvexError(
      `Name must be ${String(limits.maxNameLength)} characters or fewer.`,
    )
  }

  return normalized
}

function randomIidChunk(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = ''

  for (let index = 0; index < length; index += 1) {
    const next = Math.floor(Math.random() * alphabet.length)
    value += alphabet[next]
  }

  return value
}

async function generateUniqueIid(db: MutationCtx['db']): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${limits.iidPrefix}-${randomIidChunk(limits.iidRandomLength)}`
    const existing = await db
      .query('users')
      .withIndex('by_iid', (q) => q.eq('iid', candidate))
      .unique()

    if (!existing) {
      return candidate
    }
  }

  throw new ConvexError('Unable to allocate IID. Try again.')
}

async function listTeamsForUser(
  ctx: CtxLike,
  userId: Id<'users'>,
): Promise<TeamSummary[]> {
  const memberships = await ctx.db
    .query('teamMemberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  const teams = await Promise.all(
    memberships.map(async (membership) => {
      const team = await ctx.db.get(membership.teamId)

      if (!team) {
        return null
      }

      return {
        teamId: team._id,
        name: team.name,
        slug: team.slug,
        role: membership.role,
      } satisfies TeamSummary
    }),
  )

  return teams.filter((team): team is TeamSummary => Boolean(team))
}

async function buildProfileView(
  ctx: CtxLike,
  user: Doc<'users'>,
): Promise<ProfileView> {
  const avatarUrl = user.avatarStorageId
    ? await ctx.storage.getUrl(user.avatarStorageId)
    : null

  const teams = await listTeamsForUser(ctx, user._id)

  return {
    userId: user._id,
    workosUserId: user.workosUserId,
    iid: user.iid,
    name: user.name,
    avatarStorageId: user.avatarStorageId ?? null,
    avatarUrl,
    teams,
  }
}

export const getMe = query({
  args: {
    workosUserId: v.string(),
  },
  returns: v.union(profileViewValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getUserByWorkosUserId(ctx.db, args.workosUserId)

    if (!user) {
      return null
    }

    return buildProfileView(ctx, user)
  },
})

export const upsertMe = mutation({
  args: {
    workosUserId: v.string(),
    name: v.string(),
  },
  returns: profileViewValidator,
  handler: async (ctx, args) => {
    const normalizedName = normalizeName(args.name)
    const now = Date.now()
    const existing = await getUserByWorkosUserId(ctx.db, args.workosUserId)

    let userId: Id<'users'>

    if (existing) {
      userId = existing._id

      if (existing.name !== normalizedName) {
        await ctx.db.patch(existing._id, {
          name: normalizedName,
          updatedAt: now,
        })
      }
    } else {
      const iid = await generateUniqueIid(ctx.db)
      userId = await ctx.db.insert('users', {
        workosUserId: args.workosUserId,
        iid,
        name: normalizedName,
        createdAt: now,
        updatedAt: now,
      })
    }

    const user = await ctx.db.get(userId)

    if (!user) {
      throw new ConvexError('User profile could not be loaded after upsert.')
    }

    return buildProfileView(ctx, user)
  },
})

export const updateProfile = mutation({
  args: {
    workosUserId: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.union(v.id('_storage'), v.null())),
  },
  returns: profileViewValidator,
  handler: async (ctx, args) => {
    const user = await getUserByWorkosUserId(ctx.db, args.workosUserId)

    if (!user) {
      throw new ConvexError('User profile not initialized.')
    }

    const nextName = normalizeName(args.name)
    const now = Date.now()

    await ctx.db.patch(user._id, {
      name: nextName,
      avatarStorageId:
        args.avatarStorageId === undefined
          ? user.avatarStorageId
          : args.avatarStorageId ?? undefined,
      updatedAt: now,
    })

    const refreshed = await ctx.db.get(user._id)

    if (!refreshed) {
      throw new ConvexError('Profile update failed.')
    }

    return buildProfileView(ctx, refreshed)
  },
})
