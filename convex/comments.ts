import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import {
  canDeleteComment,
  requireMembership,
  requireUserByWorkosUserId,
} from './auth'
import { limits, normalizeText } from './model'
import { diffMentions, resolveMentionRecipientUserIds } from './mentions'
import {
  buildCommentOnPostDedupeKey,
  buildMentionInCommentDedupeKey,
  enqueueManyNotifications,
  enqueueNotification,
} from './notifications'
import { refreshPostSearchText } from './posts'

function normalizeCommentBody(value: string): string {
  const normalized = normalizeText(value)

  if (normalized.length > limits.maxCommentLength) {
    throw new ConvexError(
      `Comment must be ${String(limits.maxCommentLength)} characters or fewer.`,
    )
  }

  return normalized
}

function normalizeImageIds(imageStorageIds: Id<'_storage'>[] | undefined): Id<'_storage'>[] {
  const value = imageStorageIds ?? []

  if (value.length > limits.maxCommentImages) {
    throw new ConvexError(`You can attach up to ${String(limits.maxCommentImages)} images per comment.`)
  }

  return [...new Set(value)]
}

export const createComment = mutation({
  args: {
    actorWorkosUserId: v.string(),
    postId: v.id('posts'),
    body: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
  },
  returns: v.object({
    commentId: v.id('comments'),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const post = await ctx.db.get(args.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    await requireMembership(ctx.db, post.teamId, actor._id)

    if (post.status !== 'active') {
      throw new ConvexError('Archived posts are read-only.')
    }

    const body = normalizeCommentBody(args.body)
    const imageStorageIds = normalizeImageIds(args.imageStorageIds)

    if (!body && imageStorageIds.length === 0) {
      throw new ConvexError('Comment body or image is required.')
    }

    const now = Date.now()

    const commentId = await ctx.db.insert('comments', {
      postId: post._id,
      teamId: post.teamId,
      body,
      imageStorageIds,
      createdByUserId: actor._id,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(post._id, {
      commentCount: post.commentCount + 1,
      lastActivityAt: now,
      updatedAt: now,
      updatedByUserId: actor._id,
    })

    await refreshPostSearchText(ctx, post._id)

    if (actor._id !== post.createdByUserId) {
      await enqueueNotification(ctx, {
        teamId: post.teamId,
        recipientUserId: post.createdByUserId,
        actorUserId: actor._id,
        type: 'comment_on_post',
        dedupeKey: buildCommentOnPostDedupeKey(commentId, post.createdByUserId),
        postId: post._id,
        commentId,
      })
    }

    const mentionRecipientUserIds = await resolveMentionRecipientUserIds(
      ctx.db,
      post.teamId,
      diffMentions('', body),
      actor._id,
    )

    if (mentionRecipientUserIds.length > 0) {
      await enqueueManyNotifications(
        ctx,
        mentionRecipientUserIds.map((recipientUserId) => ({
          teamId: post.teamId,
          recipientUserId,
          actorUserId: actor._id,
          type: 'mention_in_comment' as const,
          dedupeKey: buildMentionInCommentDedupeKey(commentId, recipientUserId),
          postId: post._id,
          commentId,
        })),
      )
    }

    return {
      commentId,
    }
  },
})

export const updateComment = mutation({
  args: {
    actorWorkosUserId: v.string(),
    commentId: v.id('comments'),
    body: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
  },
  returns: v.object({
    commentId: v.id('comments'),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const comment = await ctx.db.get(args.commentId)

    if (!comment) {
      throw new ConvexError('Comment not found.')
    }

    if (comment.deletedAt) {
      throw new ConvexError('Comment has been deleted.')
    }

    if (comment.createdByUserId !== actor._id) {
      throw new ConvexError('Only the comment author can edit this comment.')
    }

    const post = await ctx.db.get(comment.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    await requireMembership(ctx.db, post.teamId, actor._id)

    if (post.status !== 'active') {
      throw new ConvexError('Archived posts are read-only.')
    }

    const body = normalizeCommentBody(args.body)
    const imageStorageIds = normalizeImageIds(args.imageStorageIds)

    if (!body && imageStorageIds.length === 0) {
      throw new ConvexError('Comment body or image is required.')
    }

    const now = Date.now()

    await ctx.db.patch(comment._id, {
      body,
      imageStorageIds,
      editedAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(post._id, {
      lastActivityAt: now,
      updatedAt: now,
      updatedByUserId: actor._id,
    })

    await refreshPostSearchText(ctx, post._id)

    const mentionRecipientUserIds = await resolveMentionRecipientUserIds(
      ctx.db,
      post.teamId,
      diffMentions(comment.body, body),
      actor._id,
    )

    if (mentionRecipientUserIds.length > 0) {
      await enqueueManyNotifications(
        ctx,
        mentionRecipientUserIds.map((recipientUserId) => ({
          teamId: post.teamId,
          recipientUserId,
          actorUserId: actor._id,
          type: 'mention_in_comment' as const,
          dedupeKey: buildMentionInCommentDedupeKey(comment._id, recipientUserId),
          postId: post._id,
          commentId: comment._id,
        })),
      )
    }

    return {
      commentId: comment._id,
    }
  },
})

export const deleteComment = mutation({
  args: {
    actorWorkosUserId: v.string(),
    commentId: v.id('comments'),
  },
  returns: v.object({
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const comment = await ctx.db.get(args.commentId)

    if (!comment) {
      throw new ConvexError('Comment not found.')
    }

    if (comment.deletedAt) {
      return { deleted: false }
    }

    const post = await ctx.db.get(comment.postId)

    if (!post) {
      throw new ConvexError('Post not found.')
    }

    const membership = await requireMembership(ctx.db, post.teamId, actor._id)

    if (!canDeleteComment(actor._id, membership.role, comment.createdByUserId)) {
      throw new ConvexError('You cannot delete this comment.')
    }

    const now = Date.now()

    await ctx.db.patch(comment._id, {
      body: '[deleted]',
      imageStorageIds: [],
      deletedAt: now,
      deletedByUserId: actor._id,
      updatedAt: now,
    })

    await ctx.db.patch(post._id, {
      commentCount: Math.max(post.commentCount - 1, 0),
      lastActivityAt: now,
      updatedAt: now,
      updatedByUserId: actor._id,
    })

    await refreshPostSearchText(ctx, post._id)

    return {
      deleted: true,
    }
  },
})
