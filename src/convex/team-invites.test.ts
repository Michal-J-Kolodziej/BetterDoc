import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import {
  evaluateEmailInviteAcceptance,
  evaluateInviteLinkAcceptance,
  resolveInviteLinkStatus,
} from '../../convex/teams'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

describe('team invite acceptance guards', () => {
  it('resolves invite link lifecycle status', () => {
    const now = 1_000_000

    expect(
      resolveInviteLinkStatus(
        {
          revokedAt: undefined,
          expiresAt: now + 1000,
          useCount: 0,
          maxUses: 25,
        },
        now,
      ),
    ).toBe('active')

    expect(
      resolveInviteLinkStatus(
        {
          revokedAt: now - 1,
          expiresAt: now + 1000,
          useCount: 0,
          maxUses: 25,
        },
        now,
      ),
    ).toBe('revoked')

    expect(
      resolveInviteLinkStatus(
        {
          revokedAt: undefined,
          expiresAt: now - 1,
          useCount: 0,
          maxUses: 25,
        },
        now,
      ),
    ).toBe('expired')

    expect(
      resolveInviteLinkStatus(
        {
          revokedAt: undefined,
          expiresAt: now + 1000,
          useCount: 25,
          maxUses: 25,
        },
        now,
      ),
    ).toBe('exhausted')
  })

  it('treats repeated link acceptance by the same user as idempotent replay', () => {
    const now = 1_000_000
    const actorUserId = asId<'users'>('user-1')

    expect(
      evaluateInviteLinkAcceptance(
        {
          revokedAt: undefined,
          expiresAt: now + 1000,
          useCount: 25,
          maxUses: 25,
          usedByUserIds: [actorUserId],
        },
        actorUserId,
        now,
      ),
    ).toBe('already_used')

    expect(
      evaluateInviteLinkAcceptance(
        {
          revokedAt: undefined,
          expiresAt: now + 1000,
          useCount: 25,
          maxUses: 25,
          usedByUserIds: [],
        },
        actorUserId,
        now,
      ),
    ).toBe('max_uses')
  })

  it('enforces email-bound acceptance checks', () => {
    expect(evaluateEmailInviteAcceptance('Teammate@Company.com', 'teammate@company.com')).toBe('ok')
    expect(evaluateEmailInviteAcceptance('teammate@company.com', undefined)).toBe('missing_email')
    expect(evaluateEmailInviteAcceptance('teammate@company.com', 'other@company.com')).toBe('email_mismatch')
  })
})
