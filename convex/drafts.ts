import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireMembership, requireUserByWorkosUserId } from './auth'
import { limits, resolveDraftExpiresAt } from './model'

type DbReaderLike = QueryCtx['db'] | MutationCtx['db']
type DbWriterCtx = Pick<MutationCtx, 'db'>
type DbReaderCtx = Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>

type TeamAccessDeps = {
  requireUserByWorkosUserId: typeof requireUserByWorkosUserId
  requireMembership: typeof requireMembership
}

const defaultTeamAccessDeps: TeamAccessDeps = {
  requireUserByWorkosUserId,
  requireMembership,
}

const postDraftViewValidator = v.object({
  draftId: v.id('postDrafts'),
  teamId: v.id('teams'),
  userId: v.id('users'),
  sourcePostId: v.union(v.id('posts'), v.null()),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  description: v.string(),
  imageStorageIds: v.array(v.id('_storage')),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
})

const commentDraftViewValidator = v.object({
  draftId: v.id('commentDrafts'),
  teamId: v.id('teams'),
  postId: v.id('posts'),
  userId: v.id('users'),
  body: v.string(),
  imageStorageIds: v.array(v.id('_storage')),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
})

function normalizeSourcePostId(sourcePostId: Id<'posts'> | null | undefined): Id<'posts'> | null {
  return sourcePostId ?? null
}

function normalizePostDraftField(
  value: string,
  fieldLabel: string,
  maxLength: number,
): string {
  if (value.length > maxLength) {
    throw new ConvexError(`${fieldLabel} must be ${String(maxLength)} characters or fewer.`)
  }

  return value
}

function normalizeCommentDraftBody(value: string): string {
  if (value.length > limits.maxCommentLength) {
    throw new ConvexError(
      `Comment must be ${String(limits.maxCommentLength)} characters or fewer.`,
    )
  }

  return value
}

function normalizePostDraftImageIds(
  imageStorageIds: Id<'_storage'>[] | undefined,
): Id<'_storage'>[] {
  const value = imageStorageIds ?? []

  if (value.length > limits.maxPostImages) {
    throw new ConvexError(`You can attach up to ${String(limits.maxPostImages)} images.`)
  }

  return [...new Set(value)]
}

function normalizeCommentDraftImageIds(
  imageStorageIds: Id<'_storage'>[] | undefined,
): Id<'_storage'>[] {
  const value = imageStorageIds ?? []

  if (value.length > limits.maxCommentImages) {
    throw new ConvexError(`You can attach up to ${String(limits.maxCommentImages)} images per comment.`)
  }

  return [...new Set(value)]
}

function toPostDraftView(draft: Doc<'postDrafts'>) {
  return {
    draftId: draft._id,
    teamId: draft.teamId,
    userId: draft.userId,
    sourcePostId: draft.sourcePostId ?? null,
    title: draft.title,
    occurrenceWhere: draft.occurrenceWhere,
    occurrenceWhen: draft.occurrenceWhen,
    description: draft.description,
    imageStorageIds: draft.imageStorageIds,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    expiresAt: draft.expiresAt,
  }
}

function toCommentDraftView(draft: Doc<'commentDrafts'>) {
  return {
    draftId: draft._id,
    teamId: draft.teamId,
    postId: draft.postId,
    userId: draft.userId,
    body: draft.body,
    imageStorageIds: draft.imageStorageIds,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    expiresAt: draft.expiresAt,
  }
}

export async function requireActorTeamMember(
  db: DbReaderLike,
  actorWorkosUserId: string,
  teamId: Id<'teams'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<Doc<'users'>> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  await deps.requireMembership(db, teamId, actor._id)
  return actor
}

export async function requireActorPostMember(
  db: DbReaderLike,
  actorWorkosUserId: string,
  postId: Id<'posts'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<{ actor: Doc<'users'>; post: Doc<'posts'> }> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  const post = await db.get(postId)

  if (!post) {
    throw new ConvexError('Post not found.')
  }

  await deps.requireMembership(db, post.teamId, actor._id)

  return { actor, post }
}

export async function getPostDraftForUser(
  ctx: DbReaderCtx,
  args: {
    userId: Id<'users'>
    teamId: Id<'teams'>
    sourcePostId?: Id<'posts'> | null
  },
) {
  const draft = await ctx.db
    .query('postDrafts')
    .withIndex('by_user_team_source_post', (query) =>
      query
        .eq('userId', args.userId)
        .eq('teamId', args.teamId)
        .eq('sourcePostId', normalizeSourcePostId(args.sourcePostId)),
    )
    .unique()

  if (!draft || draft.expiresAt <= Date.now()) {
    return null
  }

  return toPostDraftView(draft)
}

export async function upsertPostDraftForUser(
  ctx: DbWriterCtx,
  args: {
    userId: Id<'users'>
    teamId: Id<'teams'>
    sourcePostId?: Id<'posts'> | null
    title: string
    occurrenceWhere: string
    occurrenceWhen: string
    description: string
    imageStorageIds?: Id<'_storage'>[]
    expiresAt?: number
  },
) {
  const now = Date.now()
  const sourcePostId = normalizeSourcePostId(args.sourcePostId)
  const title = normalizePostDraftField(args.title, 'Title', limits.maxPostTitleLength)
  const occurrenceWhere = normalizePostDraftField(
    args.occurrenceWhere,
    'Occurrence where',
    limits.maxOccurrenceLength,
  )
  const occurrenceWhen = normalizePostDraftField(
    args.occurrenceWhen,
    'Occurrence when',
    limits.maxOccurrenceLength,
  )
  const description = normalizePostDraftField(
    args.description,
    'Issue description',
    limits.maxPostDescriptionLength,
  )
  const imageStorageIds = normalizePostDraftImageIds(args.imageStorageIds)
  const expiresAt = resolveDraftExpiresAt(now, args.expiresAt)

  const existing = await ctx.db
    .query('postDrafts')
    .withIndex('by_user_team_source_post', (query) =>
      query
        .eq('userId', args.userId)
        .eq('teamId', args.teamId)
        .eq('sourcePostId', sourcePostId),
    )
    .unique()

  if (!existing) {
    const draftId = await ctx.db.insert('postDrafts', {
      teamId: args.teamId,
      userId: args.userId,
      sourcePostId,
      title,
      occurrenceWhere,
      occurrenceWhen,
      description,
      imageStorageIds,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })

    const draft = await ctx.db.get(draftId)

    if (!draft) {
      throw new ConvexError('Draft could not be loaded.')
    }

    return toPostDraftView(draft)
  }

  await ctx.db.patch(existing._id, {
    title,
    occurrenceWhere,
    occurrenceWhen,
    description,
    imageStorageIds,
    updatedAt: now,
    expiresAt,
  })

  const refreshed = await ctx.db.get(existing._id)

  if (!refreshed) {
    throw new ConvexError('Draft could not be loaded.')
  }

  return toPostDraftView(refreshed)
}

export async function deletePostDraftForUser(
  ctx: DbWriterCtx,
  args: {
    userId: Id<'users'>
    teamId: Id<'teams'>
    sourcePostId?: Id<'posts'> | null
  },
) {
  const existing = await ctx.db
    .query('postDrafts')
    .withIndex('by_user_team_source_post', (query) =>
      query
        .eq('userId', args.userId)
        .eq('teamId', args.teamId)
        .eq('sourcePostId', normalizeSourcePostId(args.sourcePostId)),
    )
    .unique()

  if (!existing) {
    return { deleted: false }
  }

  await ctx.db.delete(existing._id)
  return { deleted: true }
}

export async function getCommentDraftForUser(
  ctx: DbReaderCtx,
  args: {
    userId: Id<'users'>
    postId: Id<'posts'>
  },
) {
  const draft = await ctx.db
    .query('commentDrafts')
    .withIndex('by_post_user', (query) => query.eq('postId', args.postId).eq('userId', args.userId))
    .unique()

  if (!draft || draft.expiresAt <= Date.now()) {
    return null
  }

  return toCommentDraftView(draft)
}

export async function upsertCommentDraftForUser(
  ctx: DbWriterCtx,
  args: {
    userId: Id<'users'>
    teamId: Id<'teams'>
    postId: Id<'posts'>
    body: string
    imageStorageIds?: Id<'_storage'>[]
    expiresAt?: number
  },
) {
  const now = Date.now()
  const body = normalizeCommentDraftBody(args.body)
  const imageStorageIds = normalizeCommentDraftImageIds(args.imageStorageIds)
  const expiresAt = resolveDraftExpiresAt(now, args.expiresAt)

  const existing = await ctx.db
    .query('commentDrafts')
    .withIndex('by_post_user', (query) => query.eq('postId', args.postId).eq('userId', args.userId))
    .unique()

  if (!existing) {
    const draftId = await ctx.db.insert('commentDrafts', {
      teamId: args.teamId,
      postId: args.postId,
      userId: args.userId,
      body,
      imageStorageIds,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })

    const draft = await ctx.db.get(draftId)

    if (!draft) {
      throw new ConvexError('Draft could not be loaded.')
    }

    return toCommentDraftView(draft)
  }

  await ctx.db.patch(existing._id, {
    body,
    imageStorageIds,
    updatedAt: now,
    expiresAt,
  })

  const refreshed = await ctx.db.get(existing._id)

  if (!refreshed) {
    throw new ConvexError('Draft could not be loaded.')
  }

  return toCommentDraftView(refreshed)
}

export async function deleteCommentDraftForUser(
  ctx: DbWriterCtx,
  args: {
    userId: Id<'users'>
    postId: Id<'posts'>
  },
) {
  const existing = await ctx.db
    .query('commentDrafts')
    .withIndex('by_post_user', (query) => query.eq('postId', args.postId).eq('userId', args.userId))
    .unique()

  if (!existing) {
    return { deleted: false }
  }

  await ctx.db.delete(existing._id)
  return { deleted: true }
}

export const getPostDraft = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    sourcePostId: v.optional(v.union(v.id('posts'), v.null())),
  },
  returns: v.union(postDraftViewValidator, v.null()),
  handler: async (ctx, args) => {
    const actor = await requireActorTeamMember(ctx.db, args.actorWorkosUserId, args.teamId)

    if (args.sourcePostId) {
      const sourcePost = await ctx.db.get(args.sourcePostId)

      if (!sourcePost || sourcePost.teamId !== args.teamId) {
        throw new ConvexError('Source post not found in this team.')
      }
    }

    return getPostDraftForUser(ctx, {
      userId: actor._id,
      teamId: args.teamId,
      sourcePostId: args.sourcePostId,
    })
  },
})

export const upsertPostDraft = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    sourcePostId: v.optional(v.union(v.id('posts'), v.null())),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    expiresAt: v.optional(v.number()),
  },
  returns: postDraftViewValidator,
  handler: async (ctx, args) => {
    const actor = await requireActorTeamMember(ctx.db, args.actorWorkosUserId, args.teamId)

    if (args.sourcePostId) {
      const sourcePost = await ctx.db.get(args.sourcePostId)

      if (!sourcePost || sourcePost.teamId !== args.teamId) {
        throw new ConvexError('Source post not found in this team.')
      }
    }

    return upsertPostDraftForUser(ctx, {
      userId: actor._id,
      teamId: args.teamId,
      sourcePostId: args.sourcePostId,
      title: args.title,
      occurrenceWhere: args.occurrenceWhere,
      occurrenceWhen: args.occurrenceWhen,
      description: args.description,
      imageStorageIds: args.imageStorageIds,
      expiresAt: args.expiresAt,
    })
  },
})

export const deletePostDraft = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    sourcePostId: v.optional(v.union(v.id('posts'), v.null())),
  },
  returns: v.object({
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireActorTeamMember(ctx.db, args.actorWorkosUserId, args.teamId)

    if (args.sourcePostId) {
      const sourcePost = await ctx.db.get(args.sourcePostId)

      if (!sourcePost || sourcePost.teamId !== args.teamId) {
        throw new ConvexError('Source post not found in this team.')
      }
    }

    return deletePostDraftForUser(ctx, {
      userId: actor._id,
      teamId: args.teamId,
      sourcePostId: args.sourcePostId,
    })
  },
})

export const getCommentDraft = query({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.union(commentDraftViewValidator, v.null()),
  handler: async (ctx, args) => {
    const { actor } = await requireActorPostMember(ctx.db, args.actorWorkosUserId, args.postId)

    return getCommentDraftForUser(ctx, {
      userId: actor._id,
      postId: args.postId,
    })
  },
})

export const upsertCommentDraft = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
    body: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    expiresAt: v.optional(v.number()),
  },
  returns: commentDraftViewValidator,
  handler: async (ctx, args) => {
    const { actor, post } = await requireActorPostMember(ctx.db, args.actorWorkosUserId, args.postId)

    if (post.status !== 'active') {
      throw new ConvexError('Only active posts accept comment drafts.')
    }

    return upsertCommentDraftForUser(ctx, {
      userId: actor._id,
      teamId: post.teamId,
      postId: args.postId,
      body: args.body,
      imageStorageIds: args.imageStorageIds,
      expiresAt: args.expiresAt,
    })
  },
})

export const deleteCommentDraft = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
  },
  returns: v.object({
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { actor } = await requireActorPostMember(ctx.db, args.actorWorkosUserId, args.postId)

    return deleteCommentDraftForUser(ctx, {
      userId: actor._id,
      postId: args.postId,
    })
  },
})
