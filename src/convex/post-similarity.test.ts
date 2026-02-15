import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import {
  clampSimilarPostLimit,
  rankSimilarPosts,
  type SimilarPostCandidate,
} from '../../convex/postSimilarity'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

function createCandidate(
  id: string,
  overrides: Partial<Omit<SimilarPostCandidate, '_id' | 'teamId'>> = {},
): SimilarPostCandidate {
  const now = Date.parse('2026-02-15T12:00:00.000Z')

  return {
    _id: asId<'posts'>(id),
    teamId: asId<'teams'>('team-1'),
    title: 'Checkout timeout',
    occurrenceWhere: 'Payments API',
    occurrenceWhen: 'During deploy',
    description: 'Customer checkout fails with timeout.',
    status: 'active',
    createdAt: now - 5 * 24 * 60 * 60 * 1000,
    updatedAt: now - 2 * 24 * 60 * 60 * 1000,
    lastActivityAt: now - 2 * 24 * 60 * 60 * 1000,
    ...overrides,
  }
}

describe('post similarity ranking', () => {
  it('is deterministic for the same input', () => {
    const now = Date.parse('2026-02-15T12:00:00.000Z')
    const candidates: SimilarPostCandidate[] = [
      createCandidate('post-a'),
      createCandidate('post-b'),
      createCandidate('post-z', {
        title: 'Checkout timeout payment service incident',
        occurrenceWhere: 'Checkout service',
        description: 'Payment service timeout seen in checkout flow.',
      }),
    ]

    const args = {
      draft: {
        title: 'Checkout payment timeout',
        occurrenceWhere: 'Checkout service',
        occurrenceWhen: 'During deploy',
        description: 'Users report payment timeout on checkout.',
      },
      candidates,
      now,
      limit: 5,
    }

    const first = rankSimilarPosts(args)
    const second = rankSimilarPosts(args)

    expect(second).toEqual(first)
    expect(first.map((entry) => entry.postId)).toEqual([
      asId<'posts'>('post-z'),
      asId<'posts'>('post-a'),
      asId<'posts'>('post-b'),
    ])
    expect(first[0]?.score ?? 0).toBeGreaterThan(first[1]?.score ?? 0)
    expect(first[0]?.reasons).toHaveLength(2)
  })

  it('supports excludePostId and skips non-overlapping entries', () => {
    const now = Date.parse('2026-02-15T12:00:00.000Z')

    const matches = rankSimilarPosts({
      draft: {
        title: 'Checkout payment timeout',
      },
      candidates: [
        createCandidate('post-1', {
          title: 'Checkout payment timeout',
        }),
        createCandidate('post-2', {
          title: 'Inventory sync warning',
          occurrenceWhere: 'Warehouse',
          description: 'Backfill drift',
        }),
      ],
      now,
      excludePostId: asId<'posts'>('post-1'),
    })

    expect(matches).toHaveLength(0)
  })

  it('clamps limit to defaults and maximum', () => {
    expect(clampSimilarPostLimit(undefined)).toBe(5)
    expect(clampSimilarPostLimit(0)).toBe(1)
    expect(clampSimilarPostLimit(2)).toBe(2)
    expect(clampSimilarPostLimit(99)).toBe(10)
  })
})
