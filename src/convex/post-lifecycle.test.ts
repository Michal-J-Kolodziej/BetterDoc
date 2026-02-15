import { describe, expect, it } from 'vitest'

import { canPromotePostToPlaybook } from '../../convex/playbooks'
import {
  canReopenPostFromStatus,
  canResolvePostFromStatus,
} from '../../convex/posts'

describe('post lifecycle transitions', () => {
  it('allows resolving only from active status', () => {
    expect(canResolvePostFromStatus('active')).toBe(true)
    expect(canResolvePostFromStatus('resolved')).toBe(false)
    expect(canResolvePostFromStatus('archived')).toBe(false)
  })

  it('allows reopening only from resolved status', () => {
    expect(canReopenPostFromStatus('active')).toBe(false)
    expect(canReopenPostFromStatus('resolved')).toBe(true)
    expect(canReopenPostFromStatus('archived')).toBe(false)
  })
})

describe('playbook promotion permission', () => {
  it('requires teamleader/admin and resolved status', () => {
    expect(canPromotePostToPlaybook('admin', 'resolved')).toBe(true)
    expect(canPromotePostToPlaybook('teamleader', 'resolved')).toBe(true)

    expect(canPromotePostToPlaybook('senior', 'resolved')).toBe(false)
    expect(canPromotePostToPlaybook('mid', 'resolved')).toBe(false)
    expect(canPromotePostToPlaybook('junior', 'resolved')).toBe(false)

    expect(canPromotePostToPlaybook('admin', 'active')).toBe(false)
    expect(canPromotePostToPlaybook('teamleader', 'archived')).toBe(false)
  })
})
