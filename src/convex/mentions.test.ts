import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  diffMentions,
  parseIidMentions,
  resolveMentionRecipientUserIds,
} from '../../convex/mentions'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder
}

type UserDoc = {
  _id: Id<'users'>
  iid: string
}

type MembershipDoc = {
  _id: Id<'teamMemberships'>
  teamId: Id<'teams'>
  userId: Id<'users'>
}

class MentionMemoryDb {
  constructor(
    private readonly usersByIid: Map<string, UserDoc>,
    private readonly memberships: MembershipDoc[],
  ) {}

  query(table: string) {
    if (table === 'users') {
      return {
        withIndex: (indexName: string, applyIndex: (builder: EqBuilder) => unknown) => {
          if (indexName !== 'by_iid') {
            throw new Error(`Unexpected users index: ${indexName}`)
          }

          const conditions: Record<string, unknown> = {}
          const builder = this.createEqBuilder(conditions)
          applyIndex(builder)

          return {
            unique: async () => {
              const iid = conditions.iid

              if (typeof iid !== 'string') {
                return null
              }

              return this.usersByIid.get(iid) ?? null
            },
          }
        },
      }
    }

    if (table === 'teamMemberships') {
      return {
        withIndex: (indexName: string, applyIndex: (builder: EqBuilder) => unknown) => {
          if (indexName !== 'by_team') {
            throw new Error(`Unexpected memberships index: ${indexName}`)
          }

          const conditions: Record<string, unknown> = {}
          const builder = this.createEqBuilder(conditions)
          applyIndex(builder)

          return {
            collect: async () => {
              const teamId = conditions.teamId

              return this.memberships.filter((membership) => membership.teamId === teamId)
            },
          }
        },
      }
    }

    throw new Error(`Unexpected table: ${table}`)
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

describe('mention helpers', () => {
  it('parses unique IID mentions in normalized uppercase form', () => {
    const mentions = parseIidMentions(
      'Ping @BD-AB12CD34, @bd-ab12cd34, @BD-ABCDEFG, and @ZZ-AB12CD34',
    )

    expect(mentions).toEqual(['BD-AB12CD34'])
  })

  it('returns only newly added mentions', () => {
    const added = diffMentions(
      'Current owners: @BD-AB12CD34 and @BD-ZZ11YY22',
      'Current owners: @BD-AB12CD34, @BD-ZZ11YY22, and @BD-QQ44WW55',
    )

    expect(added).toEqual(['BD-QQ44WW55'])
  })

  it('resolves only team-member mentions and skips actor/self mentions', async () => {
    const teamId = asId<'teams'>('team-1')
    const actorUserId = asId<'users'>('user-actor')
    const teammateUserId = asId<'users'>('user-teammate')
    const outsiderUserId = asId<'users'>('user-outsider')

    const db = new MentionMemoryDb(
      new Map<string, UserDoc>([
        ['BD-AA11BB22', { _id: actorUserId, iid: 'BD-AA11BB22' }],
        ['BD-CC33DD44', { _id: teammateUserId, iid: 'BD-CC33DD44' }],
        ['BD-EE55FF66', { _id: outsiderUserId, iid: 'BD-EE55FF66' }],
      ]),
      [
        {
          _id: asId<'teamMemberships'>('membership-1'),
          teamId,
          userId: actorUserId,
        },
        {
          _id: asId<'teamMemberships'>('membership-2'),
          teamId,
          userId: teammateUserId,
        },
      ],
    )

    const recipientUserIds = await resolveMentionRecipientUserIds(
      db as unknown as MutationCtx['db'],
      teamId,
      ['BD-AA11BB22', 'BD-CC33DD44', 'BD-EE55FF66', 'BD-UNKNOWN1'],
      actorUserId,
    )

    expect(recipientUserIds).toEqual([teammateUserId])
  })
})
