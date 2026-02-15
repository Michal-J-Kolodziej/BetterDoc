import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  canArchiveOrUnarchive,
  isManagerRole,
  requireMembership,
  requireUserByWorkosUserId,
} from './auth'
import { limits, normalizeText, postStatusValidator } from './model'
import { buildPostSearchText } from './postSearch'
import {
  clampSimilarPostLimit,
  rankSimilarPosts,
  type SimilarPostCandidate,
} from './postSimilarity'
import { diffMentions, resolveMentionRecipientUserIds } from './mentions'
import {
  buildMentionInPostDedupeKey,
  enqueueManyNotifications,
} from './notifications'

type CtxLike = Pick<QueryCtx, 'db' | 'storage'> | Pick<MutationCtx, 'db' | 'storage'>
type DbLike = QueryCtx['db'] | MutationCtx['db']

type TeamAccessDeps = {
  requireUserByWorkosUserId: typeof requireUserByWorkosUserId
  requireMembership: typeof requireMembership
}

const defaultTeamAccessDeps: TeamAccessDeps = {
  requireUserByWorkosUserId,
  requireMembership,
}

const postListItemValidator = v.object({
  postId: v.id('posts'),
  teamId: v.id('teams'),
  teamName: v.string(),
  teamSlug: v.string(),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  descriptionPreview: v.string(),
  status: postStatusValidator,
  createdByUserId: v.id('users'),
  createdByName: v.string(),
  createdByIid: v.string(),
  imageCount: v.number(),
  imageUrls: v.array(v.string()),
  commentCount: v.number(),
  lastActivityAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const postDetailValidator = v.object({
  postId: v.id('posts'),
  teamId: v.id('teams'),
  teamName: v.string(),
  teamSlug: v.string(),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  description: v.string(),
  status: postStatusValidator,
  createdByUserId: v.id('users'),
  createdByName: v.string(),
  createdByIid: v.string(),
  imageStorageIds: v.array(v.id('_storage')),
  imageUrls: v.array(v.string()),
  resolutionSummary: v.union(v.string(), v.null()),
  resolvedAt: v.union(v.number(), v.null()),
  resolvedByUserId: v.union(v.id('users'), v.null()),
  resolvedByName: v.union(v.string(), v.null()),
  resolvedByIid: v.union(v.string(), v.null()),
  commentCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastActivityAt: v.number(),
  canEdit: v.boolean(),
  canArchive: v.boolean(),
  canUnarchive: v.boolean(),
  canResolve: v.boolean(),
  canReopen: v.boolean(),
  canPromoteToPlaybook: v.boolean(),
  promotedPlaybookId: v.union(v.id('playbooks'), v.null()),
  comments: v.array(
    v.object({
      commentId: v.id('comments'),
      postId: v.id('posts'),
      body: v.string(),
      imageStorageIds: v.array(v.id('_storage')),
      imageUrls: v.array(v.string()),
      createdByUserId: v.id('users'),
      createdByName: v.string(),
      createdByIid: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      editedAt: v.union(v.number(), v.null()),
      deletedAt: v.union(v.number(), v.null()),
      canEdit: v.boolean(),
      canDelete: v.boolean(),
    }),
  ),
})

const similarPostItemValidator = v.object({
  postId: v.id('posts'),
  teamId: v.id('teams'),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  status: postStatusValidator,
  updatedAt: v.number(),
  score: v.number(),
  reasons: v.array(v.string()),
})

export async function requireActorTeamMemberForPostSimilarity(
  db: DbLike,
  actorWorkosUserId: string,
  teamId: Id<'teams'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<Doc<'users'>> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  await deps.requireMembership(db, teamId, actor._id)
  return actor
}

function normalizeRequired(value: string, label: string, maxLength: number): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new ConvexError(`${label} is required.`)
  }

  if (normalized.length > maxLength) {
    throw new ConvexError(`${label} must be ${String(maxLength)} characters or fewer.`)
  }

  return normalized
}

function normalizeImageIds(
  imageStorageIds: Id<'_storage'>[] | undefined,
  maxCount: number,
): Id<'_storage'>[] {
  const value = imageStorageIds ?? []

  if (value.length > maxCount) {
    throw new ConvexError(`You can attach up to ${String(maxCount)} images.`)
  }

  return [...new Set(value)]
}

function normalizeResolutionSummary(value: string): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new ConvexError('Resolution summary is required.')
  }

  if (normalized.length > limits.maxResolutionSummaryLength) {
    throw new ConvexError(
      `Resolution summary must be ${String(limits.maxResolutionSummaryLength)} characters or fewer.`,
    )
  }

  return normalized
}

function descriptionPreview(description: string): string {
  return description.length <= 180 ? description : `${description.slice(0, 177)}...`
}

function parseDateBoundary(value: string | undefined, mode: 'start' | 'end'): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    return null
  }

  const date = new Date(parsed)

  if (mode === 'start') {
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }

  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function listStatuses(
  status: 'active' | 'resolved' | 'archived' | 'all' | undefined,
): Array<'active' | 'resolved' | 'archived'> {
  if (!status || status === 'all') {
    return ['active', 'resolved', 'archived']
  }

  return [status]
}

export function canResolvePostFromStatus(status: Doc<'posts'>['status']): boolean {
  return status === 'active'
}

export function canReopenPostFromStatus(status: Doc<'posts'>['status']): boolean {
  return status === 'resolved'
}

async function collectTeamScopedPosts(
  ctx: QueryCtx,
  args: {
    teamId: Id<'teams'>
    status: 'active' | 'resolved' | 'archived' | 'all' | undefined
    searchText?: string
    limit: number
    createdByUserId?: Id<'users'>
  },
): Promise<Doc<'posts'>[]> {
  const statuses = listStatuses(args.status)
  const perStatusLimit = Math.max(args.limit * 2, 60)
  const hasSearch = typeof args.searchText === 'string' && args.searchText.trim().length > 0

  if (hasSearch) {
    const groups = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query('posts')
          .withSearchIndex('search_text', (search) => {
            let builder = search.search('searchText', args.searchText!.trim()).eq('teamId', args.teamId)

            builder = builder.eq('status', status)

            if (args.createdByUserId) {
              builder = builder.eq('createdByUserId', args.createdByUserId)
            }

            return builder
          })
          .take(perStatusLimit),
      ),
    )

    return groups.flat()
  }

  const groups = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query('posts')
        .withIndex('by_team_status_last_activity', (index) =>
          index.eq('teamId', args.teamId).eq('status', status),
        )
        .order('desc')
        .take(perStatusLimit),
    ),
  )

  return groups.flat()
}

async function hydratePostListItem(ctx: CtxLike, post: Doc<'posts'>) {
  const [team, creator] = await Promise.all([
    ctx.db.get(post.teamId),
    ctx.db.get(post.createdByUserId),
  ])

  if (!team || !creator) {
    return null
  }

  const rawUrls = await Promise.all(
    post.imageStorageIds.slice(0, 3).map((storageId) => ctx.storage.getUrl(storageId)),
  )

  return {
    postId: post._id,
    teamId: team._id,
    teamName: team.name,
    teamSlug: team.slug,
    title: post.title,
    occurrenceWhere: post.occurrenceWhere,
    occurrenceWhen: post.occurrenceWhen,
    descriptionPreview: descriptionPreview(post.description),
    status: post.status,
    createdByUserId: creator._id,
    createdByName: creator.name,
    createdByIid: creator.iid,
    imageCount: post.imageStorageIds.length,
    imageUrls: rawUrls.filter((url): url is string => Boolean(url)),
    commentCount: post.commentCount,
    lastActivityAt: post.lastActivityAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

export async function refreshPostSearchText(
  ctx: MutationCtx,
  postId: Id<'posts'>,
): Promise<void> {
  const post = await ctx.db.get(postId)

  if (!post) {
    return
  }

  const comments = await ctx.db
    .query('comments')
    .withIndex('by_post_created_at', (index) => index.eq('postId', postId))
    .collect()

  const searchText = buildPostSearchText({
    post,
    comments,
  })

  await ctx.db.patch(postId, {
    searchText,
  })
}

export const createPost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
  },
  returns: v.object({
    postId: v.id('posts'),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    await requireMembership(ctx.db, args.teamId, actor._id)

    const title = normalizeRequired(args.title, 'Title', limits.maxPostTitleLength)
    const occurrenceWhere = normalizeRequired(
      args.occurrenceWhere,
      'Occurrence where',
      limits.maxOccurrenceLength,
    )
    const occurrenceWhen = normalizeRequired(
      args.occurrenceWhen,
      'Occurrence when',
      limits.maxOccurrenceLength,
    )
    const description = normalizeRequired(
      args.description,
      'Issue description',
      limits.maxPostDescriptionLength,
    )
    const imageStorageIds = normalizeImageIds(args.imageStorageIds, limits.maxPostImages)

    const now = Date.now()
    const postId = await ctx.db.insert('posts', {
      teamId: args.teamId,
      title,
      occurrenceWhere,
      occurrenceWhen,
      description,
      imageStorageIds,
      status: 'active',
      createdByUserId: actor._id,
      updatedByUserId: actor._id,
      commentCount: 0,
      lastActivityAt: now,
      searchText: buildPostSearchText({
        post: {
          title,
          occurrenceWhere,
          occurrenceWhen,
          description,
        },
        comments: [],
      }),
      createdAt: now,
      updatedAt: now,
    })

    const mentionRecipientUserIds = await resolveMentionRecipientUserIds(
      ctx.db,
      args.teamId,
      diffMentions('', description),
      actor._id,
    )

    if (mentionRecipientUserIds.length > 0) {
      await enqueueManyNotifications(
        ctx,
        mentionRecipientUserIds.map((recipientUserId) => ({
          teamId: args.teamId,
          recipientUserId,
          actorUserId: actor._id,
          type: 'mention_in_post' as const,
          dedupeKey: buildMentionInPostDedupeKey(postId, recipientUserId),
          postId,
        })),
      )
    }

    return { postId }
  },
})

export const updatePost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
  },
  returns: v.object({
    postId: v.id('posts'),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    await requireMembership(ctx.db, post.teamId, actor._id)

    if (post.createdByUserId !== actor._id) {
      throw new ConvexError('Only the post creator can edit this post.')
    }

    if (post.status !== 'active') {
      throw new ConvexError('Only active posts can be edited.')
    }

    const title = normalizeRequired(args.title, 'Title', limits.maxPostTitleLength)
    const occurrenceWhere = normalizeRequired(
      args.occurrenceWhere,
      'Occurrence where',
      limits.maxOccurrenceLength,
    )
    const occurrenceWhen = normalizeRequired(
      args.occurrenceWhen,
      'Occurrence when',
      limits.maxOccurrenceLength,
    )
    const description = normalizeRequired(
      args.description,
      'Issue description',
      limits.maxPostDescriptionLength,
    )
    const imageStorageIds = normalizeImageIds(args.imageStorageIds, limits.maxPostImages)

    const now = Date.now()

    await ctx.db.patch(args.postId, {
      title,
      occurrenceWhere,
      occurrenceWhen,
      description,
      imageStorageIds,
      updatedByUserId: actor._id,
      updatedAt: now,
      lastActivityAt: now,
    })

    await refreshPostSearchText(ctx, args.postId)

    const mentionRecipientUserIds = await resolveMentionRecipientUserIds(
      ctx.db,
      post.teamId,
      diffMentions(post.description, description),
      actor._id,
    )

    if (mentionRecipientUserIds.length > 0) {
      await enqueueManyNotifications(
        ctx,
        mentionRecipientUserIds.map((recipientUserId) => ({
          teamId: post.teamId,
          recipientUserId,
          actorUserId: actor._id,
          type: 'mention_in_post' as const,
          dedupeKey: buildMentionInPostDedupeKey(args.postId, recipientUserId),
          postId: args.postId,
        })),
      )
    }

    return { postId: args.postId }
  },
})

export const resolvePost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
    resolutionSummary: v.string(),
  },
  returns: v.object({
    postId: v.id('posts'),
    status: postStatusValidator,
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    if (!canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)) {
      throw new ConvexError('You are not allowed to resolve this post.')
    }

    if (post.status === 'resolved') {
      return {
        postId: post._id,
        status: 'resolved' as const,
      }
    }

    if (!canResolvePostFromStatus(post.status)) {
      throw new ConvexError('Only active posts can be resolved.')
    }

    const resolutionSummary = normalizeResolutionSummary(args.resolutionSummary)
    const now = Date.now()

    await ctx.db.patch(post._id, {
      status: 'resolved',
      resolutionSummary,
      resolvedAt: now,
      resolvedByUserId: actor._id,
      updatedByUserId: actor._id,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId: post._id,
      status: 'resolved' as const,
    }
  },
})

export const reopenPost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.object({
    postId: v.id('posts'),
    status: postStatusValidator,
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    if (!canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)) {
      throw new ConvexError('You are not allowed to reopen this post.')
    }

    if (post.status === 'active') {
      return {
        postId: post._id,
        status: 'active' as const,
      }
    }

    if (!canReopenPostFromStatus(post.status)) {
      throw new ConvexError('Only resolved posts can be reopened.')
    }

    const now = Date.now()

    await ctx.db.patch(post._id, {
      status: 'active',
      resolutionSummary: undefined,
      resolvedAt: undefined,
      resolvedByUserId: undefined,
      updatedByUserId: actor._id,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId: post._id,
      status: 'active' as const,
    }
  },
})

export const archivePost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.object({
    postId: v.id('posts'),
    status: postStatusValidator,
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    if (!canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)) {
      throw new ConvexError('You are not allowed to archive this post.')
    }

    if (post.status === 'archived') {
      return {
        postId: post._id,
        status: 'archived' as const,
      }
    }

    const now = Date.now()

    await ctx.db.patch(post._id, {
      status: 'archived',
      archivedAt: now,
      archivedByUserId: actor._id,
      updatedByUserId: actor._id,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId: post._id,
      status: 'archived' as const,
    }
  },
})

export const unarchivePost = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.object({
    postId: v.id('posts'),
    status: postStatusValidator,
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    if (!canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)) {
      throw new ConvexError('You are not allowed to unarchive this post.')
    }

    if (post.status === 'active') {
      return {
        postId: post._id,
        status: 'active' as const,
      }
    }

    if (post.status !== 'archived') {
      throw new ConvexError('Only archived posts can be unarchived.')
    }

    const now = Date.now()

    await ctx.db.patch(post._id, {
      status: 'active',
      archivedAt: undefined,
      archivedByUserId: undefined,
      updatedByUserId: actor._id,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId: post._id,
      status: 'active' as const,
    }
  },
})

export const listPosts = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.optional(v.id('teams')),
    searchText: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal('active'), v.literal('resolved'), v.literal('archived'), v.literal('all')),
    ),
    authorIid: v.optional(v.string()),
    hasImage: v.optional(v.boolean()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(postListItemValidator),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const memberships = await ctx.db
      .query('teamMemberships')
      .withIndex('by_user', (index) => index.eq('userId', actor._id))
      .collect()

    const membershipByTeam = new Map(memberships.map((membership) => [membership.teamId, membership]))

    const teamIds = args.teamId
      ? [args.teamId]
      : memberships.map((membership) => membership.teamId)

    if (teamIds.length === 0) {
      return []
    }

    if (args.teamId && !membershipByTeam.has(args.teamId)) {
      throw new ConvexError('You are not a member of this team.')
    }

    let createdByUserId: Id<'users'> | undefined

    if (args.authorIid) {
      const normalizedAuthorIid = normalizeText(args.authorIid).toUpperCase()
      const author = await ctx.db
        .query('users')
        .withIndex('by_iid', (index) => index.eq('iid', normalizedAuthorIid))
        .unique()

      if (!author) {
        return []
      }

      createdByUserId = author._id
    }

    const limit = Math.min(Math.max(args.limit ?? 40, 1), 100)

    const postGroups = await Promise.all(
      teamIds.map((teamId) =>
        collectTeamScopedPosts(ctx, {
          teamId,
          status: args.status,
          searchText: args.searchText,
          limit,
          createdByUserId,
        }),
      ),
    )

    const beforeBoundary = parseDateBoundary(args.before, 'end')
    const afterBoundary = parseDateBoundary(args.after, 'start')

    const deduped = new Map<Id<'posts'>, Doc<'posts'>>()

    for (const post of postGroups.flat()) {
      if (args.hasImage === true && post.imageStorageIds.length === 0) {
        continue
      }

      if (beforeBoundary && post.lastActivityAt > beforeBoundary) {
        continue
      }

      if (afterBoundary && post.lastActivityAt < afterBoundary) {
        continue
      }

      deduped.set(post._id, post)
    }

    const sorted = [...deduped.values()]
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt)
      .slice(0, limit)

    const hydrated = await Promise.all(sorted.map((post) => hydratePostListItem(ctx, post)))

    return hydrated.filter((item): item is NonNullable<typeof item> => Boolean(item))
  },
})

export const findSimilar = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    title: v.optional(v.string()),
    occurrenceWhere: v.optional(v.string()),
    occurrenceWhen: v.optional(v.string()),
    description: v.optional(v.string()),
    excludePostId: v.optional(v.id('posts')),
    limit: v.optional(v.number()),
  },
  returns: v.array(similarPostItemValidator),
  handler: async (ctx, args) => {
    await requireActorTeamMemberForPostSimilarity(ctx.db, args.actorWorkosUserId, args.teamId)

    const limit = clampSimilarPostLimit(args.limit)
    const candidateFetchLimit = Math.max(limit * 30, 200)

    const candidates: SimilarPostCandidate[] = await ctx.db
      .query('posts')
      .withIndex('by_team_last_activity', (index) => index.eq('teamId', args.teamId))
      .order('desc')
      .take(candidateFetchLimit)

    return rankSimilarPosts({
      draft: {
        title: args.title,
        occurrenceWhere: args.occurrenceWhere,
        occurrenceWhen: args.occurrenceWhen,
        description: args.description,
      },
      candidates,
      now: Date.now(),
      limit,
      excludePostId: args.excludePostId,
    })
  },
})

export const getPostDetail = query({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: postDetailValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    const [team, creator, promotedPlaybook] = await Promise.all([
      ctx.db.get(post.teamId),
      ctx.db.get(post.createdByUserId),
      ctx.db
        .query('playbooks')
        .withIndex('by_team_source_post', (index) =>
          index.eq('teamId', post.teamId).eq('sourcePostId', post._id),
        )
        .unique(),
    ])

    if (!team || !creator) {
      throw new ConvexError('Post contains invalid references.')
    }

    const resolvedBy = post.resolvedByUserId ? await ctx.db.get(post.resolvedByUserId) : null

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_post_created_at', (index) => index.eq('postId', post._id))
      .collect()

    const commentViews = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.createdByUserId)

        if (!author) {
          return null
        }

        const imageUrls = await Promise.all(
          comment.imageStorageIds.map((storageId) => ctx.storage.getUrl(storageId)),
        )

        return {
          commentId: comment._id,
          postId: comment.postId,
          body: comment.deletedAt ? '[deleted]' : comment.body,
          imageStorageIds: comment.deletedAt ? [] : comment.imageStorageIds,
          imageUrls: comment.deletedAt
            ? []
            : imageUrls.filter((url): url is string => Boolean(url)),
          createdByUserId: author._id,
          createdByName: author.name,
          createdByIid: author.iid,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          editedAt: comment.editedAt ?? null,
          deletedAt: comment.deletedAt ?? null,
          canEdit:
            !comment.deletedAt &&
            post.status === 'active' &&
            comment.createdByUserId === actor._id,
          canDelete:
            !comment.deletedAt &&
            post.status === 'active' &&
            (comment.createdByUserId === actor._id ||
              membership.role === 'admin' ||
              membership.role === 'teamleader'),
        }
      }),
    )

    const postImageUrls = await Promise.all(
      post.imageStorageIds.map((storageId) => ctx.storage.getUrl(storageId)),
    )

    const canArchive =
      post.status !== 'archived' &&
      canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)
    const canUnarchive =
      post.status === 'archived' &&
      canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)
    const canResolve =
      canResolvePostFromStatus(post.status) &&
      canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)
    const canReopen =
      canReopenPostFromStatus(post.status) &&
      canArchiveOrUnarchive(actor._id, membership.role, post.createdByUserId)
    const canPromoteToPlaybook =
      post.status === 'resolved' && isManagerRole(membership.role) && !promotedPlaybook

    return {
      postId: post._id,
      teamId: team._id,
      teamName: team.name,
      teamSlug: team.slug,
      title: post.title,
      occurrenceWhere: post.occurrenceWhere,
      occurrenceWhen: post.occurrenceWhen,
      description: post.description,
      status: post.status,
      createdByUserId: creator._id,
      createdByName: creator.name,
      createdByIid: creator.iid,
      imageStorageIds: post.imageStorageIds,
      imageUrls: postImageUrls.filter((url): url is string => Boolean(url)),
      resolutionSummary: post.resolutionSummary ?? null,
      resolvedAt: post.resolvedAt ?? null,
      resolvedByUserId: resolvedBy?._id ?? null,
      resolvedByName: resolvedBy?.name ?? null,
      resolvedByIid: resolvedBy?.iid ?? null,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      lastActivityAt: post.lastActivityAt,
      canEdit: post.createdByUserId === actor._id && post.status === 'active',
      canArchive,
      canUnarchive,
      canResolve,
      canReopen,
      canPromoteToPlaybook,
      promotedPlaybookId: promotedPlaybook?._id ?? null,
      comments: commentViews
        .filter((comment): comment is NonNullable<typeof comment> => Boolean(comment))
        .sort((left, right) => left.createdAt - right.createdAt),
    }
  },
})
