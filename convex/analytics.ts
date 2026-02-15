import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import {
  requireMembership,
  requireUserByWorkosUserId,
} from './auth'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const recurringTopicValidator = v.object({
  label: v.string(),
  count: v.number(),
})

const contributorValidator = v.object({
  userId: v.id('users'),
  name: v.string(),
  iid: v.string(),
  postCount: v.number(),
  commentCount: v.number(),
  totalCount: v.number(),
})

const teamOverviewValidator = v.object({
  teamId: v.id('teams'),
  teamName: v.string(),
  teamSlug: v.string(),
  rangeDays: v.union(v.literal(30), v.literal(90)),
  windowStartAt: v.number(),
  windowEndAt: v.number(),
  totals: v.object({
    postsInWindow: v.number(),
    resolved: v.number(),
    archived: v.number(),
    unresolvedOpen: v.number(),
    medianTimeToResolutionHours: v.union(v.number(), v.null()),
  }),
  recurringTopics: v.array(recurringTopicValidator),
  topContributors: v.array(contributorValidator),
})

type DbLike = QueryCtx['db']
type TeamAccessDeps = {
  requireUserByWorkosUserId: typeof requireUserByWorkosUserId
  requireMembership: typeof requireMembership
}

const defaultTeamAccessDeps: TeamAccessDeps = {
  requireUserByWorkosUserId,
  requireMembership,
}

type OverviewInput = {
  now: number
  rangeDays: 30 | 90
  posts: Array<
    Pick<
      Doc<'posts'>,
      | '_id'
      | 'title'
      | 'occurrenceWhere'
      | 'createdByUserId'
      | 'createdAt'
      | 'updatedAt'
      | 'lastActivityAt'
      | 'status'
      | 'resolvedAt'
      | 'archivedAt'
    >
  >
  comments: Array<Pick<Doc<'comments'>, 'postId' | 'createdByUserId' | 'createdAt'>>
}

type ContributorCounts = {
  postCount: number
  commentCount: number
}

const recurringStopWords = new Set([
  'about',
  'after',
  'before',
  'during',
  'error',
  'issue',
  'incident',
  'service',
  'team',
  'when',
  'where',
  'with',
  'from',
  'that',
  'this',
  'have',
  'into',
  'over',
  'under',
  'http',
  'https',
])

export function computeMedianDurationHours(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) {
    return null
  }

  const sorted = [...durationsMs].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)
  const medianMs =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint]

  return Math.round((medianMs / (60 * 60 * 1000)) * 10) / 10
}

function buildRecurringTopics(
  posts: Array<Pick<Doc<'posts'>, 'title' | 'occurrenceWhere'>>,
): Array<{ label: string; count: number }> {
  const tokenCounts = new Map<string, number>()

  for (const post of posts) {
    const tokens = new Set(
      `${post.title} ${post.occurrenceWhere}`
        .toLowerCase()
        .match(/[a-z0-9]{4,}/g) ?? [],
    )

    for (const token of tokens) {
      if (recurringStopWords.has(token)) {
        continue
      }

      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
    }
  }

  return [...tokenCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return left[0].localeCompare(right[0])
    })
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }))
}

export function buildTeamOverviewSnapshot(input: OverviewInput): {
  windowStartAt: number
  windowEndAt: number
  totals: {
    postsInWindow: number
    resolved: number
    archived: number
    unresolvedOpen: number
    medianTimeToResolutionHours: number | null
  }
  recurringTopics: Array<{ label: string; count: number }>
  contributorCounts: Map<Id<'users'>, ContributorCounts>
} {
  const windowStartAt = input.now - input.rangeDays * MS_PER_DAY
  const windowEndAt = input.now
  const postsInWindow = input.posts.filter(
    (post) =>
      post.createdAt >= windowStartAt ||
      post.updatedAt >= windowStartAt ||
      post.lastActivityAt >= windowStartAt ||
      (post.resolvedAt ?? 0) >= windowStartAt ||
      (post.archivedAt ?? 0) >= windowStartAt,
  )

  const resolved = postsInWindow.filter((post) => post.status === 'resolved').length
  const archived = postsInWindow.filter((post) => post.status === 'archived').length
  const unresolvedOpen = input.posts.filter((post) => post.status === 'active').length

  const resolvedDurationsMs = postsInWindow
    .filter((post) => post.status === 'resolved' && typeof post.resolvedAt === 'number')
    .map((post) => Math.max(0, (post.resolvedAt ?? post.createdAt) - post.createdAt))

  const recurringTopics = buildRecurringTopics(postsInWindow)

  const contributorCounts = new Map<Id<'users'>, ContributorCounts>()

  for (const post of input.posts) {
    if (post.createdAt < windowStartAt) {
      continue
    }

    const existing = contributorCounts.get(post.createdByUserId)

    if (!existing) {
      contributorCounts.set(post.createdByUserId, {
        postCount: 1,
        commentCount: 0,
      })
      continue
    }

    contributorCounts.set(post.createdByUserId, {
      postCount: existing.postCount + 1,
      commentCount: existing.commentCount,
    })
  }

  for (const comment of input.comments) {
    if (comment.createdAt < windowStartAt) {
      continue
    }

    const existing = contributorCounts.get(comment.createdByUserId)

    if (!existing) {
      contributorCounts.set(comment.createdByUserId, {
        postCount: 0,
        commentCount: 1,
      })
      continue
    }

    contributorCounts.set(comment.createdByUserId, {
      postCount: existing.postCount,
      commentCount: existing.commentCount + 1,
    })
  }

  return {
    windowStartAt,
    windowEndAt,
    totals: {
      postsInWindow: postsInWindow.length,
      resolved,
      archived,
      unresolvedOpen,
      medianTimeToResolutionHours: computeMedianDurationHours(resolvedDurationsMs),
    },
    recurringTopics,
    contributorCounts,
  }
}

export async function requireActorTeamMemberForAnalytics(
  db: DbLike,
  actorWorkosUserId: string,
  teamId: Id<'teams'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<Doc<'users'>> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  await deps.requireMembership(db, teamId, actor._id)
  return actor
}

export const getTeamOverview = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    rangeDays: v.union(v.literal(30), v.literal(90)),
  },
  returns: teamOverviewValidator,
  handler: async (ctx, args) => {
    await requireActorTeamMemberForAnalytics(ctx.db, args.actorWorkosUserId, args.teamId)

    const team = await ctx.db.get(args.teamId)

    if (!team) {
      throw new ConvexError('Team not found.')
    }

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_team_last_activity', (index) => index.eq('teamId', args.teamId))
      .collect()

    const commentsByPost = await Promise.all(
      posts.map((post) =>
        ctx.db
          .query('comments')
          .withIndex('by_post_created_at', (index) => index.eq('postId', post._id))
          .collect(),
      ),
    )

    const comments = commentsByPost.flat()
    const now = Date.now()

    const snapshot = buildTeamOverviewSnapshot({
      now,
      rangeDays: args.rangeDays,
      posts,
      comments,
    })

    const contributorRows = [...snapshot.contributorCounts.entries()]
      .sort((left, right) => {
        const leftTotal = left[1].postCount + left[1].commentCount
        const rightTotal = right[1].postCount + right[1].commentCount

        if (rightTotal !== leftTotal) {
          return rightTotal - leftTotal
        }

        return String(left[0]).localeCompare(String(right[0]))
      })
      .slice(0, 8)

    const topContributors = (
      await Promise.all(
        contributorRows.map(async ([userId, counts]) => {
          const user = await ctx.db.get(userId)

          if (!user) {
            return null
          }

          const totalCount = counts.postCount + counts.commentCount

          return {
            userId: user._id,
            name: user.name,
            iid: user.iid,
            postCount: counts.postCount,
            commentCount: counts.commentCount,
            totalCount,
          }
        }),
      )
    ).filter((value): value is NonNullable<typeof value> => Boolean(value))

    return {
      teamId: team._id,
      teamName: team.name,
      teamSlug: team.slug,
      rangeDays: args.rangeDays,
      windowStartAt: snapshot.windowStartAt,
      windowEndAt: snapshot.windowEndAt,
      totals: snapshot.totals,
      recurringTopics: snapshot.recurringTopics,
      topContributors,
    }
  },
})
