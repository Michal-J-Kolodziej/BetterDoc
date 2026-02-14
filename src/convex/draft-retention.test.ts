import { describe, expect, it } from 'vitest'

import { limits, resolveDraftExpiresAt } from '../../convex/model'

describe('resolveDraftExpiresAt', () => {
  it('uses the provided future expiry when present', () => {
    const now = 1_700_000_000_000
    const requested = now + 86_400_000

    expect(resolveDraftExpiresAt(now, requested)).toBe(requested)
  })

  it('falls back to default retention when missing or stale', () => {
    const now = 1_700_000_000_000

    expect(resolveDraftExpiresAt(now, undefined)).toBe(now + limits.draftRetentionMs)
    expect(resolveDraftExpiresAt(now, null)).toBe(now + limits.draftRetentionMs)
    expect(resolveDraftExpiresAt(now, now - 1)).toBe(now + limits.draftRetentionMs)
  })
})
