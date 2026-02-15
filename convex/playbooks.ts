import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  isManagerRole,
  requireMembership,
  requireUserByWorkosUserId,
} from './auth'
import { postStatusValidator, type TeamRole } from './model'

type DbLike = QueryCtx['db'] | MutationCtx['db']

type TeamAccessDeps = {
  requireUserByWorkosUserId: typeof requireUserByWorkosUserId
  requireMembership: typeof requireMembership
}

const defaultTeamAccessDeps: TeamAccessDeps = {
  requireUserByWorkosUserId,
  requireMembership,
}

const playbookSummaryValidator = v.object({
  playbookId: v.id('playbooks'),
  teamId: v.id('teams'),
  sourcePostId: v.id('posts'),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  issueSummaryPreview: v.string(),
  resolutionSummaryPreview: v.string(),
  promotedByUserId: v.id('users'),
  promotedByName: v.string(),
  promotedByIid: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const playbookDetailValidator = v.object({
  playbookId: v.id('playbooks'),
  teamId: v.id('teams'),
  teamName: v.string(),
  teamSlug: v.string(),
  sourcePostId: v.id('posts'),
  sourcePostStatus: postStatusValidator,
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  issueSummary: v.string(),
  resolutionSummary: v.string(),
  promotedByUserId: v.id('users'),
  promotedByName: v.string(),
  promotedByIid: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function preview(value: string): string {
  return value.length <= 180 ? value : `${value.slice(0, 177)}...`
}

export function canPromotePostToPlaybook(
  role: TeamRole,
  postStatus: Doc<'posts'>['status'],
): boolean {
  return isManagerRole(role) && postStatus === 'resolved'
}

export async function requireActorTeamMemberForPlaybooks(
  db: DbLike,
  actorWorkosUserId: string,
  teamId: Id<'teams'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<{ actor: Doc<'users'>; membership: Doc<'teamMemberships'> }> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  const membership = await deps.requireMembership(db, teamId, actor._id)
  return { actor, membership }
}

async function toPlaybookSummary(
  db: QueryCtx['db'] | MutationCtx['db'],
  playbook: Doc<'playbooks'>,
) {
  const promoter = await db.get(playbook.promotedByUserId)

  if (!promoter) {
    throw new ConvexError('Playbook references a missing user.')
  }

  return {
    playbookId: playbook._id,
    teamId: playbook.teamId,
    sourcePostId: playbook.sourcePostId,
    title: playbook.title,
    occurrenceWhere: playbook.occurrenceWhere,
    occurrenceWhen: playbook.occurrenceWhen,
    issueSummaryPreview: preview(playbook.issueSummary),
    resolutionSummaryPreview: preview(playbook.resolutionSummary),
    promotedByUserId: promoter._id,
    promotedByName: promoter.name,
    promotedByIid: promoter.iid,
    createdAt: playbook.createdAt,
    updatedAt: playbook.updatedAt,
  }
}

export const promoteFromPost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.object({
    created: v.boolean(),
    playbook: playbookSummaryValidator,
  }),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const { actor, membership } = await requireActorTeamMemberForPlaybooks(
      ctx.db,
      args.actorWorkosUserId,
      post.teamId,
    )

    if (!isManagerRole(membership.role)) {
      throw new ConvexError('Only team leaders and admins can promote playbooks.')
    }

    if (!canPromotePostToPlaybook(membership.role, post.status)) {
      throw new ConvexError('Only resolved posts can be promoted to playbooks.')
    }

    const resolutionSummary = post.resolutionSummary?.trim() ?? ''

    if (!resolutionSummary) {
      throw new ConvexError('Resolved post is missing a resolution summary.')
    }

    const existing = await ctx.db
      .query('playbooks')
      .withIndex('by_team_source_post', (index) =>
        index.eq('teamId', post.teamId).eq('sourcePostId', post._id),
      )
      .unique()

    if (existing) {
      return {
        created: false,
        playbook: await toPlaybookSummary(ctx.db, existing),
      }
    }

    const now = Date.now()
    const playbookId = await ctx.db.insert('playbooks', {
      teamId: post.teamId,
      sourcePostId: post._id,
      title: post.title,
      occurrenceWhere: post.occurrenceWhere,
      occurrenceWhen: post.occurrenceWhen,
      issueSummary: post.description,
      resolutionSummary,
      promotedByUserId: actor._id,
      createdAt: now,
      updatedAt: now,
    })

    const playbook = await ctx.db.get(playbookId)

    if (!playbook) {
      throw new ConvexError('Playbook could not be loaded.')
    }

    return {
      created: true,
      playbook: await toPlaybookSummary(ctx.db, playbook),
    }
  },
})

export const listTeamPlaybooks = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    limit: v.optional(v.number()),
  },
  returns: v.array(playbookSummaryValidator),
  handler: async (ctx, args) => {
    await requireActorTeamMemberForPlaybooks(ctx.db, args.actorWorkosUserId, args.teamId)

    const limit = Math.min(Math.max(args.limit ?? 40, 1), 100)
    const playbooks = await ctx.db
      .query('playbooks')
      .withIndex('by_team_updated_at', (index) => index.eq('teamId', args.teamId))
      .order('desc')
      .take(limit)

    return Promise.all(playbooks.map((playbook) => toPlaybookSummary(ctx.db, playbook)))
  },
})

export const getPlaybookDetail = query({
  args: {
    actorWorkosUserId: v.string(),
    playbookId: v.id('playbooks'),
  },
  returns: playbookDetailValidator,
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId)

    if (!playbook) {
      throw new ConvexError('Playbook not found.')
    }

    await requireActorTeamMemberForPlaybooks(ctx.db, args.actorWorkosUserId, playbook.teamId)

    const [team, promoter, sourcePost] = await Promise.all([
      ctx.db.get(playbook.teamId),
      ctx.db.get(playbook.promotedByUserId),
      ctx.db.get(playbook.sourcePostId),
    ])

    if (!team || !promoter || !sourcePost) {
      throw new ConvexError('Playbook references missing records.')
    }

    return {
      playbookId: playbook._id,
      teamId: team._id,
      teamName: team.name,
      teamSlug: team.slug,
      sourcePostId: sourcePost._id,
      sourcePostStatus: sourcePost.status,
      title: playbook.title,
      occurrenceWhere: playbook.occurrenceWhere,
      occurrenceWhen: playbook.occurrenceWhen,
      issueSummary: playbook.issueSummary,
      resolutionSummary: playbook.resolutionSummary,
      promotedByUserId: promoter._id,
      promotedByName: promoter.name,
      promotedByIid: promoter.iid,
      createdAt: playbook.createdAt,
      updatedAt: playbook.updatedAt,
    }
  },
})
