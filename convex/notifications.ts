import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import { notificationTypeValidator } from './model'

const enqueueArgsValidator = v.object({
  teamId: v.id('teams'),
  recipientUserId: v.id('users'),
  actorUserId: v.optional(v.id('users')),
  type: notificationTypeValidator,
  dedupeKey: v.string(),
  inviteId: v.optional(v.id('teamInvites')),
  postId: v.optional(v.id('posts')),
  commentId: v.optional(v.id('comments')),
})

const enqueueResultValidator = v.object({
  notificationId: v.id('notifications'),
  created: v.boolean(),
})

type EnqueueNotificationInput = {
  teamId: Id<'teams'>
  recipientUserId: Id<'users'>
  actorUserId?: Id<'users'>
  type: 'invite_received' | 'comment_on_post'
  dedupeKey: string
  inviteId?: Id<'teamInvites'>
  postId?: Id<'posts'>
  commentId?: Id<'comments'>
}

type EnqueueResult = {
  notificationId: Id<'notifications'>
  created: boolean
}

type NotificationWriterCtx = Pick<MutationCtx, 'db'>

function normalizeDedupeKey(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new ConvexError('Notification dedupe key is required.')
  }

  return normalized
}

export function buildInviteReceivedDedupeKey(
  inviteId: Id<'teamInvites'>,
  recipientUserId: Id<'users'>,
): string {
  return `invite_received:${String(inviteId)}:${String(recipientUserId)}`
}

export function buildCommentOnPostDedupeKey(
  commentId: Id<'comments'>,
  recipientUserId: Id<'users'>,
): string {
  return `comment_on_post:${String(commentId)}:${String(recipientUserId)}`
}

export async function enqueueNotification(
  ctx: NotificationWriterCtx,
  args: EnqueueNotificationInput,
): Promise<EnqueueResult> {
  const dedupeKey = normalizeDedupeKey(args.dedupeKey)
  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_dedupe_key', (query) => query.eq('dedupeKey', dedupeKey))
    .unique()

  if (existing) {
    return {
      notificationId: existing._id,
      created: false,
    }
  }

  const notificationId = await ctx.db.insert('notifications', {
    teamId: args.teamId,
    recipientUserId: args.recipientUserId,
    actorUserId: args.actorUserId ?? null,
    type: args.type,
    dedupeKey,
    inviteId: args.inviteId ?? null,
    postId: args.postId ?? null,
    commentId: args.commentId ?? null,
    readAt: null,
    createdAt: Date.now(),
  })

  return {
    notificationId,
    created: true,
  }
}

export async function enqueueManyNotifications(
  ctx: NotificationWriterCtx,
  notifications: EnqueueNotificationInput[],
): Promise<{
  createdCount: number
  notifications: EnqueueResult[]
}> {
  const results: EnqueueResult[] = []

  for (const notification of notifications) {
    const result = await enqueueNotification(ctx, notification)
    results.push(result)
  }

  return {
    createdCount: results.filter((result) => result.created).length,
    notifications: results,
  }
}

export const enqueue = internalMutation({
  args: enqueueArgsValidator,
  returns: enqueueResultValidator,
  handler: async (ctx, args) => enqueueNotification(ctx, args),
})

export const enqueueMany = internalMutation({
  args: {
    notifications: v.array(enqueueArgsValidator),
  },
  returns: v.object({
    createdCount: v.number(),
    notifications: v.array(enqueueResultValidator),
  }),
  handler: async (ctx, args) => enqueueManyNotifications(ctx, args.notifications),
})
