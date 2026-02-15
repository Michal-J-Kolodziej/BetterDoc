import { describe, expect, it } from 'vitest'

import {
  createTeamInviteToken,
  hashTeamInviteToken,
  normalizeTeamInviteToken,
  parseTeamInviteToken,
} from '../../convex/inviteTokens'

describe('team invite tokens', () => {
  it('creates parseable email and link tokens', () => {
    const emailToken = createTeamInviteToken('email')
    const linkToken = createTeamInviteToken('link')

    expect(parseTeamInviteToken(emailToken)?.kind).toBe('email')
    expect(parseTeamInviteToken(linkToken)?.kind).toBe('link')
  })

  it('normalizes and hashes tokens deterministically', async () => {
    const first = await hashTeamInviteToken('  sample-token  ')
    const second = await hashTeamInviteToken('sample-token')

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(normalizeTeamInviteToken('  a  ')).toBe('a')
  })

  it('rejects malformed token formats', () => {
    expect(parseTeamInviteToken('')).toBeNull()
    expect(parseTeamInviteToken('raw-token')).toBeNull()
    expect(parseTeamInviteToken('bdi1_wrong_kind_secret')).toBeNull()
  })
})
