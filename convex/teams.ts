import { ConvexError, v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  canAssignRole,
  canManageMember,
  ensureTeamExists,
  getMembership,
  isManagerRole,
  requireMembership,
  requireUserByWorkosUserId,
} from './auth'
import {
  inviteStatusValidator,
  limits,
  normalizeText,
  slugify,
  teamRoleValidator,
} from './model'

type CtxLike = Pick<QueryCtx, 'db' | 'storage'> | Pick<MutationCtx, 'db' | 'storage'>

const teamSummaryValidator = v.object({
  teamId: v.id('teams'),
  name: v.string(),
  slug: v.string(),
  role: teamRoleValidator,
})

const teamMemberValidator = v.object({
  userId: v.id('users'),
  iid: v.string(),
  name: v.string(),
  role: teamRoleValidator,
  avatarUrl: v.union(v.string(), v.null()),
  avatarStorageId: v.union(v.id('_storage'), v.null()),
})

const inviteViewValidator = v.object({
  inviteId: v.id('teamInvites'),
  teamId: v.id('teams'),
  teamName: v.string(),
  teamSlug: v.string(),
  invitedByUserId: v.id('users'),
  invitedByName: v.string(),
  invitedByIid: v.string(),
  role: teamRoleValidator,
  status: inviteStatusValidator,
  createdAt: v.number(),
  respondedAt: v.union(v.number(), v.null()),
  expiresAt: v.number(),
})

function normalizeTeamName(value: string): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new ConvexError('Team name is required.')
  }

  if (normalized.length > limits.maxTeamNameLength) {
    throw new ConvexError(
      `Team name must be ${String(limits.maxTeamNameLength)} characters or fewer.`,
    )
  }

  return normalized
}

async function generateUniqueTeamSlug(
  db: MutationCtx['db'],
  teamName: string,
): Promise<string> {
  const base = slugify(teamName) || 'team'

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${String(attempt + 1)}`
    const candidate = `${base}${suffix}`
    const existing = await db
      .query('teams')
      .withIndex('by_slug', (query) => query.eq('slug', candidate))
      .unique()

    if (!existing) {
      return candidate
    }
  }

  throw new ConvexError('Unable to create a unique team slug.')
}

async function buildInviteView(
  ctx: CtxLike,
  invite: Doc<'teamInvites'>,
) {
  const [team, inviter] = await Promise.all([
    ctx.db.get(invite.teamId),
    ctx.db.get(invite.invitedByUserId),
  ])

  if (!team || !inviter) {
    throw new ConvexError('Invite references missing records.')
  }

  return {
    inviteId: invite._id,
    teamId: team._id,
    teamName: team.name,
    teamSlug: team.slug,
    invitedByUserId: inviter._id,
    invitedByName: inviter.name,
    invitedByIid: inviter.iid,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
    respondedAt: invite.respondedAt ?? null,
    expiresAt: invite.expiresAt,
  }
}

export const listMyTeams = query({
  args: {
    actorWorkosUserId: v.string(),
  },
  returns: v.array(teamSummaryValidator),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const memberships = await ctx.db
      .query('teamMemberships')
      .withIndex('by_user', (query) => query.eq('userId', actor._id))
      .collect()

    const result = await Promise.all(
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
        }
      }),
    )

    return result.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  },
})

export const createTeam = mutation({
  args: {
    actorWorkosUserId: v.string(),
    name: v.string(),
  },
  returns: teamSummaryValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const name = normalizeTeamName(args.name)
    const slug = await generateUniqueTeamSlug(ctx.db, name)
    const now = Date.now()

    const teamId = await ctx.db.insert('teams', {
      name,
      slug,
      createdByUserId: actor._id,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('teamMemberships', {
      teamId,
      userId: actor._id,
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    })

    return {
      teamId,
      name,
      slug,
      role: 'admin' as const,
    }
  },
})

export const listTeamMembers = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
  },
  returns: v.array(teamMemberValidator),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    await ensureTeamExists(ctx.db, args.teamId)
    await requireMembership(ctx.db, args.teamId, actor._id)

    const memberships = await ctx.db
      .query('teamMemberships')
      .withIndex('by_team', (query) => query.eq('teamId', args.teamId))
      .collect()

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)

        if (!user) {
          return null
        }

        const avatarUrl = user.avatarStorageId
          ? await ctx.storage.getUrl(user.avatarStorageId)
          : null

        return {
          userId: user._id,
          iid: user.iid,
          name: user.name,
          role: membership.role,
          avatarStorageId: user.avatarStorageId ?? null,
          avatarUrl,
        }
      }),
    )

    return members
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .sort((left, right) => left.name.localeCompare(right.name))
  },
})

export const inviteByIID = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    iid: v.string(),
    role: teamRoleValidator,
  },
  returns: inviteViewValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const actorMembership = await requireMembership(ctx.db, args.teamId, actor._id)

    if (!isManagerRole(actorMembership.role)) {
      throw new ConvexError('Only team leaders and admins can invite users.')
    }

    if (!canAssignRole(actorMembership.role, args.role)) {
      throw new ConvexError('You cannot assign that role.')
    }

    const iid = normalizeText(args.iid).toUpperCase()

    const invitedUser = await ctx.db
      .query('users')
      .withIndex('by_iid', (query) => query.eq('iid', iid))
      .unique()

    if (!invitedUser) {
      throw new ConvexError('No BetterDoc user with this IID was found.')
    }

    if (invitedUser._id === actor._id) {
      throw new ConvexError('You are already in this team.')
    }

    const existingMembership = await getMembership(ctx.db, args.teamId, invitedUser._id)

    if (existingMembership) {
      throw new ConvexError('This user is already a team member.')
    }

    const now = Date.now()
    const existingInvites = await ctx.db
      .query('teamInvites')
      .withIndex('by_team_invited_user', (query) =>
        query.eq('teamId', args.teamId).eq('invitedUserId', invitedUser._id),
      )
      .collect()

    const pendingInvite = existingInvites.find(
      (invite) => invite.status === 'pending' && invite.expiresAt > now,
    )

    if (pendingInvite) {
      await ctx.db.patch(pendingInvite._id, {
        role: args.role,
        invitedByUserId: actor._id,
        expiresAt: now + limits.inviteDurationMs,
      })

      const refreshed = await ctx.db.get(pendingInvite._id)

      if (!refreshed) {
        throw new ConvexError('Invite could not be loaded.')
      }

      return buildInviteView(ctx, refreshed)
    }

    const inviteId = await ctx.db.insert('teamInvites', {
      teamId: args.teamId,
      invitedByUserId: actor._id,
      invitedUserId: invitedUser._id,
      role: args.role,
      status: 'pending',
      createdAt: now,
      expiresAt: now + limits.inviteDurationMs,
    })

    const invite = await ctx.db.get(inviteId)

    if (!invite) {
      throw new ConvexError('Invite could not be loaded.')
    }

    return buildInviteView(ctx, invite)
  },
})

export const listMyInvites = query({
  args: {
    actorWorkosUserId: v.string(),
    status: v.optional(inviteStatusValidator),
  },
  returns: v.array(inviteViewValidator),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const statuses: Doc<'teamInvites'>['status'][] = args.status
      ? [args.status]
      : ['pending', 'accepted', 'declined', 'revoked']

    const groups = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query('teamInvites')
          .withIndex('by_invited_user_status', (query) =>
            query.eq('invitedUserId', actor._id).eq('status', status),
          )
          .collect(),
      ),
    )

    const views = await Promise.all(
      groups
        .flat()
        .map((invite) => buildInviteView(ctx, invite)),
    )

    return views.sort((left, right) => right.createdAt - left.createdAt)
  },
})

export const respondInvite = mutation({
  args: {
    actorWorkosUserId: v.string(),
    inviteId: v.id('teamInvites'),
    action: v.union(v.literal('accept'), v.literal('decline')),
  },
  returns: inviteViewValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const invite = await ctx.db.get(args.inviteId)

    if (!invite) {
      throw new ConvexError('Invite not found.')
    }

    if (invite.invitedUserId !== actor._id) {
      throw new ConvexError('This invite does not belong to you.')
    }

    if (invite.status !== 'pending') {
      return buildInviteView(ctx, invite)
    }

    const now = Date.now()

    if (invite.expiresAt <= now) {
      await ctx.db.patch(invite._id, {
        status: 'revoked',
        respondedAt: now,
      })

      const refreshed = await ctx.db.get(invite._id)

      if (!refreshed) {
        throw new ConvexError('Invite could not be loaded.')
      }

      return buildInviteView(ctx, refreshed)
    }

    if (args.action === 'decline') {
      await ctx.db.patch(invite._id, {
        status: 'declined',
        respondedAt: now,
      })

      const refreshed = await ctx.db.get(invite._id)

      if (!refreshed) {
        throw new ConvexError('Invite could not be loaded.')
      }

      return buildInviteView(ctx, refreshed)
    }

    const existingMembership = await getMembership(ctx.db, invite.teamId, actor._id)

    if (!existingMembership) {
      await ctx.db.insert('teamMemberships', {
        teamId: invite.teamId,
        userId: actor._id,
        role: invite.role,
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.patch(invite._id, {
      status: 'accepted',
      respondedAt: now,
    })

    const refreshed = await ctx.db.get(invite._id)

    if (!refreshed) {
      throw new ConvexError('Invite could not be loaded.')
    }

    return buildInviteView(ctx, refreshed)
  },
})

export const updateMemberRole = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    memberUserId: v.id('users'),
    role: teamRoleValidator,
  },
  returns: teamMemberValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const actorMembership = await requireMembership(ctx.db, args.teamId, actor._id)

    if (!isManagerRole(actorMembership.role)) {
      throw new ConvexError('Only team leaders and admins can assign roles.')
    }

    if (!canAssignRole(actorMembership.role, args.role)) {
      throw new ConvexError('You cannot assign that role.')
    }

    const member = await requireMembership(ctx.db, args.teamId, args.memberUserId)

    if (!canManageMember(actorMembership.role, member.role)) {
      throw new ConvexError('You cannot change this member role.')
    }

    await ctx.db.patch(member._id, {
      role: args.role,
      updatedAt: Date.now(),
    })

    const user = await ctx.db.get(member.userId)

    if (!user) {
      throw new ConvexError('User not found.')
    }

    const avatarUrl = user.avatarStorageId
      ? await ctx.storage.getUrl(user.avatarStorageId)
      : null

    return {
      userId: user._id,
      iid: user.iid,
      name: user.name,
      role: args.role,
      avatarStorageId: user.avatarStorageId ?? null,
      avatarUrl,
    }
  },
})

export const removeMember = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    memberUserId: v.id('users'),
  },
  returns: v.object({
    removed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const actorMembership = await requireMembership(ctx.db, args.teamId, actor._id)

    if (!isManagerRole(actorMembership.role)) {
      throw new ConvexError('Only team leaders and admins can remove members.')
    }

    const member = await requireMembership(ctx.db, args.teamId, args.memberUserId)

    if (!canManageMember(actorMembership.role, member.role)) {
      throw new ConvexError('You cannot remove this member.')
    }

    if (member.role === 'admin') {
      const memberships = await ctx.db
        .query('teamMemberships')
        .withIndex('by_team', (query) => query.eq('teamId', args.teamId))
        .collect()

      const adminCount = memberships.filter((entry) => entry.role === 'admin').length

      if (adminCount <= 1) {
        throw new ConvexError('At least one admin must remain in the team.')
      }
    }

    await ctx.db.delete(member._id)

    return {
      removed: true,
    }
  },
})
