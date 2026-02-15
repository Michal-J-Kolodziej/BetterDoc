import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  markAllNotificationsReadForRecipient,
  markNotificationReadForRecipient,
  paginateInboxNotifications,
} from '../../convex/notifications'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder
}

type NotificationDoc = {
  _id: Id<'notifications'>
  _creationTime: number
  recipientUserId: Id<'users'>
  createdAt: number
  readAt: number | null
  type: 'invite_received' | 'comment_on_post' | 'mention_in_post' | 'mention_in_comment'
  teamId: Id<'teams'>
  actorUserId: Id<'users'> | null
  inviteId: Id<'teamInvites'> | null
  postId: Id<'posts'> | null
  commentId: Id<'comments'> | null
}

class NotificationMemoryDb {
  constructor(private readonly notifications: Map<string, NotificationDoc>) {}

  async get(id: Id<'notifications'>) {
    return this.notifications.get(String(id)) ?? null
  }

  async patch(id: Id<'notifications'>, value: Partial<NotificationDoc>) {
    const existing = this.notifications.get(String(id))

    if (!existing) {
      throw new Error('Notification not found for patch')
    }

    this.notifications.set(String(id), {
      ...existing,
      ...value,
    })
  }

  query(table: string) {
    if (table !== 'notifications') {
      throw new Error(`Unexpected table: ${table}`)
    }

    return {
      withIndex: (indexName: string, applyIndex: (builder: EqBuilder) => unknown) => {
        if (indexName !== 'by_recipient_read_created_at') {
          throw new Error(`Unexpected index: ${indexName}`)
        }

        const conditions: Record<string, unknown> = {}
        const builder = this.createEqBuilder(conditions)
        applyIndex(builder)

        return {
          collect: async () => {
            const recipientUserId = conditions.recipientUserId
            const readAt = conditions.readAt

            return [...this.notifications.values()].filter(
              (notification) =>
                notification.recipientUserId === recipientUserId && notification.readAt === readAt,
            )
          },
        }
      },
    }
  }

  private createEqBuilder(conditions: Record<string, unknown>): EqBuilder {
    const builder: EqBuilder = {
      eq: (field: string, value: unknown) => {
        conditions[field] = value
        return builder
      },
    }

    return builder
  }
}

function createNotificationDoc(seed: {
  id: string
  createdAt: number
  creationTime: number
  recipientUserId: Id<'users'>
  readAt?: number | null
}): NotificationDoc {
  return {
    _id: asId<'notifications'>(seed.id),
    _creationTime: seed.creationTime,
    recipientUserId: seed.recipientUserId,
    createdAt: seed.createdAt,
    readAt: seed.readAt ?? null,
    type: 'mention_in_post',
    teamId: asId<'teams'>('team-1'),
    actorUserId: asId<'users'>('actor-1'),
    inviteId: null,
    postId: asId<'posts'>('post-1'),
    commentId: null,
  }
}

describe('inbox pagination helper', () => {
  it('paginates without duplicates or missing entries', () => {
    const recipientUserId = asId<'users'>('user-1')
    const notifications = [
      createNotificationDoc({ id: 'n1', createdAt: 5000, creationTime: 100, recipientUserId }),
      createNotificationDoc({ id: 'n2', createdAt: 5000, creationTime: 90, recipientUserId }),
      createNotificationDoc({ id: 'n3', createdAt: 4990, creationTime: 80, recipientUserId }),
      createNotificationDoc({ id: 'n4', createdAt: 4980, creationTime: 70, recipientUserId }),
      createNotificationDoc({ id: 'n5', createdAt: 4980, creationTime: 60, recipientUserId }),
      createNotificationDoc({ id: 'n6', createdAt: 4970, creationTime: 50, recipientUserId }),
      createNotificationDoc({ id: 'n7', createdAt: 4960, creationTime: 40, recipientUserId }),
    ]

    const pageOne = paginateInboxNotifications(notifications, undefined, 3)
    const pageTwo = paginateInboxNotifications(notifications, pageOne.nextCursor ?? undefined, 3)
    const pageThree = paginateInboxNotifications(notifications, pageTwo.nextCursor ?? undefined, 3)

    const orderedIds = [...pageOne.page, ...pageTwo.page, ...pageThree.page].map((entry) => entry._id)

    expect(orderedIds).toEqual([
      asId<'notifications'>('n1'),
      asId<'notifications'>('n2'),
      asId<'notifications'>('n3'),
      asId<'notifications'>('n4'),
      asId<'notifications'>('n5'),
      asId<'notifications'>('n6'),
      asId<'notifications'>('n7'),
    ])

    expect(new Set(orderedIds).size).toBe(7)
    expect(pageThree.hasMore).toBe(false)
    expect(pageThree.nextCursor).toBeNull()
  })
})

describe('notification read helpers', () => {
  it('marks one notification as read idempotently', async () => {
    const recipientUserId = asId<'users'>('user-1')
    const otherUserId = asId<'users'>('user-2')
    const notification = createNotificationDoc({
      id: 'notification-1',
      createdAt: 1000,
      creationTime: 10,
      recipientUserId,
    })

    const db = new NotificationMemoryDb(new Map([[String(notification._id), notification]]))
    const ctx = { db } as unknown as Pick<MutationCtx, 'db'>

    const first = await markNotificationReadForRecipient(ctx, notification._id, recipientUserId)
    const second = await markNotificationReadForRecipient(ctx, notification._id, recipientUserId)
    const third = await markNotificationReadForRecipient(ctx, notification._id, otherUserId)

    expect(first.updated).toBe(true)
    expect(second.updated).toBe(false)
    expect(third.updated).toBe(false)
  })

  it('marks all unread notifications idempotently', async () => {
    const recipientUserId = asId<'users'>('user-1')
    const otherUserId = asId<'users'>('user-2')

    const notifications = new Map<string, NotificationDoc>([
      [
        'n1',
        createNotificationDoc({
          id: 'n1',
          createdAt: 2000,
          creationTime: 20,
          recipientUserId,
        }),
      ],
      [
        'n2',
        createNotificationDoc({
          id: 'n2',
          createdAt: 1990,
          creationTime: 19,
          recipientUserId,
        }),
      ],
      [
        'n3',
        createNotificationDoc({
          id: 'n3',
          createdAt: 1980,
          creationTime: 18,
          recipientUserId,
          readAt: 1,
        }),
      ],
      [
        'n4',
        createNotificationDoc({
          id: 'n4',
          createdAt: 1970,
          creationTime: 17,
          recipientUserId: otherUserId,
        }),
      ],
    ])

    const db = new NotificationMemoryDb(notifications)
    const ctx = { db } as unknown as Pick<MutationCtx, 'db'>

    const first = await markAllNotificationsReadForRecipient(ctx, recipientUserId)
    const second = await markAllNotificationsReadForRecipient(ctx, recipientUserId)

    expect(first).toBe(2)
    expect(second).toBe(0)
  })
})
