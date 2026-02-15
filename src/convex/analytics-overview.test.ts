import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import {
  buildTeamOverviewSnapshot,
  computeMedianDurationHours,
} from '../../convex/analytics'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

describe('analytics helpers', () => {
  it('computes median resolution hours', () => {
    expect(computeMedianDurationHours([])).toBeNull()
    expect(computeMedianDurationHours([2 * 60 * 60 * 1000])).toBe(2)
    expect(computeMedianDurationHours([2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000])).toBe(3)
  })

  it('builds overview metrics with resolved/archived split and contributor counts', () => {
    const now = Date.parse('2026-02-15T12:00:00.000Z')
    const dayMs = 24 * 60 * 60 * 1000

    const user1 = asId<'users'>('user-1')
    const user2 = asId<'users'>('user-2')
    const user3 = asId<'users'>('user-3')

    const posts = [
      {
        _id: asId<'posts'>('post-active'),
        title: 'Checkout timeout spikes',
        occurrenceWhere: 'Checkout API',
        createdByUserId: user1,
        createdAt: now - 6 * dayMs,
        updatedAt: now - 1 * dayMs,
        lastActivityAt: now - 1 * dayMs,
        status: 'active' as const,
        resolvedAt: undefined,
        archivedAt: undefined,
      },
      {
        _id: asId<'posts'>('post-resolved-1'),
        title: 'Checkout queue timeout',
        occurrenceWhere: 'Payments API',
        createdByUserId: user1,
        createdAt: now - 12 * dayMs,
        updatedAt: now - 9 * dayMs,
        lastActivityAt: now - 9 * dayMs,
        status: 'resolved' as const,
        resolvedAt: now - 11 * dayMs,
        archivedAt: undefined,
      },
      {
        _id: asId<'posts'>('post-resolved-2'),
        title: 'Checkout retry failure',
        occurrenceWhere: 'Payments Worker',
        createdByUserId: user2,
        createdAt: now - 8 * dayMs,
        updatedAt: now - 6 * dayMs,
        lastActivityAt: now - 6 * dayMs,
        status: 'resolved' as const,
        resolvedAt: now - 6 * dayMs,
        archivedAt: undefined,
      },
      {
        _id: asId<'posts'>('post-archived'),
        title: 'Legacy report mismatch',
        occurrenceWhere: 'Reporting API',
        createdByUserId: user3,
        createdAt: now - 4 * dayMs,
        updatedAt: now - 2 * dayMs,
        lastActivityAt: now - 2 * dayMs,
        status: 'archived' as const,
        resolvedAt: undefined,
        archivedAt: now - 2 * dayMs,
      },
    ]

    const comments = [
      {
        postId: asId<'posts'>('post-active'),
        createdByUserId: user2,
        createdAt: now - 3 * dayMs,
      },
      {
        postId: asId<'posts'>('post-resolved-1'),
        createdByUserId: user2,
        createdAt: now - 10 * dayMs,
      },
      {
        postId: asId<'posts'>('post-resolved-2'),
        createdByUserId: user1,
        createdAt: now - 7 * dayMs,
      },
    ]

    const snapshot = buildTeamOverviewSnapshot({
      now,
      rangeDays: 30,
      posts,
      comments,
    })

    expect(snapshot.totals.postsInWindow).toBe(4)
    expect(snapshot.totals.resolved).toBe(2)
    expect(snapshot.totals.archived).toBe(1)
    expect(snapshot.totals.unresolvedOpen).toBe(1)
    expect(snapshot.totals.medianTimeToResolutionHours).toBe(36)

    expect(snapshot.recurringTopics[0]).toEqual({
      label: 'checkout',
      count: 3,
    })

    expect(snapshot.contributorCounts.get(user1)).toEqual({
      postCount: 2,
      commentCount: 1,
    })
    expect(snapshot.contributorCounts.get(user2)).toEqual({
      postCount: 1,
      commentCount: 2,
    })
    expect(snapshot.contributorCounts.get(user3)).toEqual({
      postCount: 1,
      commentCount: 0,
    })
  })
})
