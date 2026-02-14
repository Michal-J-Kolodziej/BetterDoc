import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  buildCommentOnPostDedupeKey,
  buildInviteReceivedDedupeKey,
  enqueueManyNotifications,
  enqueueNotification,
} from '../../convex/notifications'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

type MockNotificationRef = { _id: Id<'notifications'> }

type MockIndexBuilder = {
  eq: (field: string, value: string) => MockIndexBuilder
}

type MockDb = {
  query: (table: string) => {
    withIndex: (
      indexName: string,
      applyIndex: (builder: MockIndexBuilder) => void,
    ) => {
      unique: () => Promise<MockNotificationRef | null>
    }
  }
  insert: (table: string, value: { dedupeKey: string }) => Promise<Id<'notifications'>>
}

function createNotificationCtx(): Pick<MutationCtx, 'db'> {
  const byDedupeKey = new Map<string, MockNotificationRef>()
  let nextId = 1

  const db: MockDb = {
    query(table: string) {
      if (table !== 'notifications') {
        throw new Error(`Unexpected table: ${String(table)}`)
      }

      return {
        withIndex(indexName: string, applyIndex: (builder: MockIndexBuilder) => void) {
          if (indexName !== 'by_dedupe_key') {
            throw new Error(`Unexpected index: ${String(indexName)}`)
          }

          let key: string | null = null
          const indexBuilder = {
            eq(field: string, value: string) {
              if (field !== 'dedupeKey') {
                throw new Error(`Unexpected field: ${field}`)
              }

              key = value
              return indexBuilder
            },
          }

          applyIndex(indexBuilder)

          return {
            unique: async () => (key ? byDedupeKey.get(key) ?? null : null),
          }
        },
      }
    },
    async insert(table: string, value: { dedupeKey: string }) {
      if (table !== 'notifications') {
        throw new Error(`Unexpected table: ${String(table)}`)
      }

      const notificationId = asId<'notifications'>(`notification-${String(nextId)}`)
      nextId += 1

      byDedupeKey.set(value.dedupeKey, {
        _id: notificationId,
      })

      return notificationId
    },
  }

  return {
    db,
  } as unknown as Pick<MutationCtx, 'db'>
}

describe('notifications enqueue primitives', () => {
  it('dedupes enqueue by dedupeKey', async () => {
    const ctx = createNotificationCtx()
    const teamId = asId<'teams'>('team-1')
    const recipientUserId = asId<'users'>('user-1')
    const actorUserId = asId<'users'>('user-2')
    const commentId = asId<'comments'>('comment-1')
    const dedupeKey = buildCommentOnPostDedupeKey(commentId, recipientUserId)

    const first = await enqueueNotification(ctx, {
      teamId,
      recipientUserId,
      actorUserId,
      type: 'comment_on_post',
      dedupeKey,
      commentId,
    })

    const second = await enqueueNotification(ctx, {
      teamId,
      recipientUserId,
      actorUserId,
      type: 'comment_on_post',
      dedupeKey,
      commentId,
    })

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.notificationId).toBe(first.notificationId)
  })

  it('dedupes across enqueueMany payloads', async () => {
    const ctx = createNotificationCtx()
    const teamId = asId<'teams'>('team-1')
    const recipientUserId = asId<'users'>('user-1')
    const actorUserId = asId<'users'>('user-2')
    const inviteId = asId<'teamInvites'>('invite-1')
    const secondInviteId = asId<'teamInvites'>('invite-2')

    const firstDedupeKey = buildInviteReceivedDedupeKey(inviteId, recipientUserId)
    const secondDedupeKey = buildInviteReceivedDedupeKey(secondInviteId, recipientUserId)

    const result = await enqueueManyNotifications(ctx, [
      {
        teamId,
        recipientUserId,
        actorUserId,
        type: 'invite_received',
        dedupeKey: firstDedupeKey,
        inviteId,
      },
      {
        teamId,
        recipientUserId,
        actorUserId,
        type: 'invite_received',
        dedupeKey: firstDedupeKey,
        inviteId,
      },
      {
        teamId,
        recipientUserId,
        actorUserId,
        type: 'invite_received',
        dedupeKey: secondDedupeKey,
        inviteId: secondInviteId,
      },
    ])

    expect(result.createdCount).toBe(2)
    expect(result.notifications).toHaveLength(3)
    expect(result.notifications.map((entry) => entry.created)).toEqual([true, false, true])
  })

  it('rejects blank dedupe keys', async () => {
    const ctx = createNotificationCtx()

    await expect(
      enqueueNotification(ctx, {
        teamId: asId<'teams'>('team-1'),
        recipientUserId: asId<'users'>('user-1'),
        type: 'invite_received',
        dedupeKey: '   ',
      }),
    ).rejects.toThrow('Notification dedupe key is required.')
  })
})
