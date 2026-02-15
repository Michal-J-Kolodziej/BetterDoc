import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireUserByWorkosUserId } from './auth'
import { notificationTypeValidator, type NotificationType } from './model'

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

const inboxItemValidator = v.object({
  notificationId: v.id('notifications'),
  teamId: v.id('teams'),
  type: notificationTypeValidator,
  actorUserId: v.union(v.id('users'), v.null()),
  actorName: v.union(v.string(), v.null()),
  actorIid: v.union(v.string(), v.null()),
  inviteId: v.union(v.id('teamInvites'), v.null()),
  postId: v.union(v.id('posts'), v.null()),
  commentId: v.union(v.id('comments'), v.null()),
  title: v.string(),
  body: v.string(),
  href: v.string(),
  readAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
})

type EnqueueNotificationInput = {
  teamId: Id<'teams'>
  recipientUserId: Id<'users'>
  actorUserId?: Id<'users'>
  type: NotificationType
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
type NotificationReaderCtx = Pick<QueryCtx, 'db'>

type InboxCursor = {
  createdAt: number
  creationTime: number
  notificationId: string
}

type NotificationLike = Pick<
  Doc<'notifications'>,
  '_id' | '_creationTime' | 'createdAt' | 'readAt' | 'type' | 'teamId' | 'actorUserId' | 'inviteId' | 'postId' | 'commentId'
>

function normalizeDedupeKey(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new ConvexError('Notification dedupe key is required.')
  }

  return normalized
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 20
  }

  return Math.min(Math.max(Math.trunc(value), 1), 50)
}

function parseInboxCursor(value: string | undefined): InboxCursor | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<InboxCursor>

    if (
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.creationTime !== 'number' ||
      typeof parsed.notificationId !== 'string'
    ) {
      return null
    }

    return {
      createdAt: parsed.createdAt,
      creationTime: parsed.creationTime,
      notificationId: parsed.notificationId,
    }
  } catch {
    return null
  }
}

function encodeInboxCursor(notification: NotificationLike): string {
  return JSON.stringify({
    createdAt: notification.createdAt,
    creationTime: notification._creationTime,
    notificationId: String(notification._id),
  } satisfies InboxCursor)
}

function compareNotificationsDesc(left: NotificationLike, right: NotificationLike): number {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt
  }

  if (left._creationTime !== right._creationTime) {
    return right._creationTime - left._creationTime
  }

  return String(right._id).localeCompare(String(left._id))
}

function isBeforeCursor(notification: NotificationLike, cursor: InboxCursor): boolean {
  if (notification.createdAt !== cursor.createdAt) {
    return notification.createdAt < cursor.createdAt
  }

  if (notification._creationTime !== cursor.creationTime) {
    return notification._creationTime < cursor.creationTime
  }

  return String(notification._id).localeCompare(cursor.notificationId) < 0
}

export function paginateInboxNotifications(
  notifications: NotificationLike[],
  cursorValue: string | undefined,
  requestedLimit: number | undefined,
): {
  page: NotificationLike[]
  nextCursor: string | null
  hasMore: boolean
} {
  const limit = normalizeLimit(requestedLimit)
  const cursor = parseInboxCursor(cursorValue)

  const sorted = [...notifications].sort(compareNotificationsDesc)
  const scoped = cursor ? sorted.filter((entry) => isBeforeCursor(entry, cursor)) : sorted

  const page = scoped.slice(0, limit)
  const hasMore = scoped.length > limit
  const nextCursor = hasMore && page.length > 0 ? encodeInboxCursor(page[page.length - 1]) : null

  return {
    page,
    nextCursor,
    hasMore,
  }
}

function buildNotificationLink(notification: NotificationLike): string {
  switch (notification.type) {
    case 'invite_received':
      return '/teams'
    case 'comment_on_post':
    case 'mention_in_post':
      return notification.postId ? `/posts/${String(notification.postId)}` : '/dashboard'
    case 'mention_in_comment':
      if (!notification.postId) {
        return '/dashboard'
      }

      if (!notification.commentId) {
        return `/posts/${String(notification.postId)}`
      }

      return `/posts/${String(notification.postId)}#comment-${String(notification.commentId)}`
  }
}

function buildNotificationCopy(
  notification: NotificationLike,
  actorName: string | null,
): {
  title: string
  body: string
} {
  const actorLabel = actorName ?? 'A teammate'

  switch (notification.type) {
    case 'invite_received':
      return {
        title: 'Team invite',
        body: `${actorLabel} invited you to join a team.`,
      }
    case 'comment_on_post':
      return {
        title: 'New comment',
        body: `${actorLabel} commented on your post.`,
      }
    case 'mention_in_post':
      return {
        title: 'Mentioned in post',
        body: `${actorLabel} mentioned you in a post.`,
      }
    case 'mention_in_comment':
      return {
        title: 'Mentioned in comment',
        body: `${actorLabel} mentioned you in a comment.`,
      }
  }
}

async function buildInboxItem(
  ctx: NotificationReaderCtx,
  notification: NotificationLike,
): Promise<{
  notificationId: Id<'notifications'>
  teamId: Id<'teams'>
  type: NotificationType
  actorUserId: Id<'users'> | null
  actorName: string | null
  actorIid: string | null
  inviteId: Id<'teamInvites'> | null
  postId: Id<'posts'> | null
  commentId: Id<'comments'> | null
  title: string
  body: string
  href: string
  readAt: number | null
  createdAt: number
}> {
  const actor = notification.actorUserId ? await ctx.db.get(notification.actorUserId) : null
  const copy = buildNotificationCopy(notification, actor?.name ?? null)

  return {
    notificationId: notification._id,
    teamId: notification.teamId,
    type: notification.type,
    actorUserId: notification.actorUserId,
    actorName: actor?.name ?? null,
    actorIid: actor?.iid ?? null,
    inviteId: notification.inviteId ?? null,
    postId: notification.postId ?? null,
    commentId: notification.commentId ?? null,
    title: copy.title,
    body: copy.body,
    href: buildNotificationLink(notification),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
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

export function buildMentionInPostDedupeKey(
  postId: Id<'posts'>,
  recipientUserId: Id<'users'>,
): string {
  return `mention_in_post:${String(postId)}:${String(recipientUserId)}`
}

export function buildMentionInCommentDedupeKey(
  commentId: Id<'comments'>,
  recipientUserId: Id<'users'>,
): string {
  return `mention_in_comment:${String(commentId)}:${String(recipientUserId)}`
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

export async function markNotificationReadForRecipient(
  ctx: NotificationWriterCtx,
  notificationId: Id<'notifications'>,
  recipientUserId: Id<'users'>,
): Promise<{ updated: boolean }> {
  const notification = await ctx.db.get(notificationId)

  if (!notification || notification.recipientUserId !== recipientUserId) {
    return {
      updated: false,
    }
  }

  if (notification.readAt !== null) {
    return {
      updated: false,
    }
  }

  await ctx.db.patch(notification._id, {
    readAt: Date.now(),
  })

  return {
    updated: true,
  }
}

export async function markAllNotificationsReadForRecipient(
  ctx: NotificationWriterCtx,
  recipientUserId: Id<'users'>,
): Promise<number> {
  const unread = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_read_created_at', (query) =>
      query.eq('recipientUserId', recipientUserId).eq('readAt', null),
    )
    .collect()

  if (unread.length === 0) {
    return 0
  }

  const now = Date.now()

  for (const notification of unread) {
    await ctx.db.patch(notification._id, {
      readAt: now,
    })
  }

  return unread.length
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

export const getUnreadCount = query({
  args: {
    actorWorkosUserId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_read_created_at', (query) =>
        query.eq('recipientUserId', actor._id).eq('readAt', null),
      )
      .collect()

    return unread.length
  },
})

export const listInbox = query({
  args: {
    actorWorkosUserId: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(inboxItemValidator),
    nextCursor: v.union(v.string(), v.null()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)

    const all = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_created_at', (query) => query.eq('recipientUserId', actor._id))
      .order('desc')
      .collect()

    const paged = paginateInboxNotifications(all, args.cursor, args.limit)
    const items = await Promise.all(paged.page.map((notification) => buildInboxItem(ctx, notification)))

    return {
      items,
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  },
})

export const markRead = mutation({
  args: {
    actorWorkosUserId: v.string(),
    notificationId: v.id('notifications'),
  },
  returns: v.object({
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    return markNotificationReadForRecipient(ctx, args.notificationId, actor._id)
  },
})

export const markAllRead = mutation({
  args: {
    actorWorkosUserId: v.string(),
  },
  returns: v.object({
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const updatedCount = await markAllNotificationsReadForRecipient(ctx, actor._id)
    return {
      updatedCount,
    }
  },
})
