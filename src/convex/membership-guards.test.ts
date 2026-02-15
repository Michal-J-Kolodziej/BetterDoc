import { describe, expect, it, vi } from 'vitest'

import type { Doc, Id, TableNames } from '../../convex/_generated/dataModel'
import type { QueryCtx } from '../../convex/_generated/server'
import { requireActorTeamMemberForAnalytics } from '../../convex/analytics'
import { requireActorPostMember } from '../../convex/drafts'
import { requireActorTeamMemberForPlaybooks } from '../../convex/playbooks'
import { requireActorTeamMemberForPostSimilarity } from '../../convex/posts'
import { requireActorTeamMember } from '../../convex/templates'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

describe('membership guard helpers', () => {
  it('enforces team membership before template operations', async () => {
    const teamId = asId<'teams'>('team-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId,
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {} as unknown as QueryCtx['db']

    const result = await requireActorTeamMember(db, 'workos-user-1', teamId, {
      requireUserByWorkosUserId,
      requireMembership,
    })

    expect(result._id).toBe(actor._id)
    expect(requireUserByWorkosUserId).toHaveBeenCalledWith(db, 'workos-user-1')
    expect(requireMembership).toHaveBeenCalledWith(db, teamId, actor._id)
  })

  it('enforces post team membership before comment draft operations', async () => {
    const postId = asId<'posts'>('post-1')
    const teamId = asId<'teams'>('team-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const post = {
      _id: postId,
      teamId,
    } as unknown as Doc<'posts'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId,
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {
      get: vi.fn(async (id: Id<'posts'>) => (id === postId ? post : null)),
    } as unknown as QueryCtx['db']

    const result = await requireActorPostMember(db, 'workos-user-1', postId, {
      requireUserByWorkosUserId,
      requireMembership,
    })

    expect(result.actor._id).toBe(actor._id)
    expect(result.post._id).toBe(postId)
    expect(requireUserByWorkosUserId).toHaveBeenCalledWith(db, 'workos-user-1')
    expect(requireMembership).toHaveBeenCalledWith(db, teamId, actor._id)
  })

  it('enforces team membership before similar post lookups', async () => {
    const teamId = asId<'teams'>('team-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId,
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {} as unknown as QueryCtx['db']

    const result = await requireActorTeamMemberForPostSimilarity(db, 'workos-user-1', teamId, {
      requireUserByWorkosUserId,
      requireMembership,
    })

    expect(result._id).toBe(actor._id)
    expect(requireUserByWorkosUserId).toHaveBeenCalledWith(db, 'workos-user-1')
    expect(requireMembership).toHaveBeenCalledWith(db, teamId, actor._id)
  })

  it('enforces team membership before playbook operations', async () => {
    const teamId = asId<'teams'>('team-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId,
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {} as unknown as QueryCtx['db']

    const result = await requireActorTeamMemberForPlaybooks(db, 'workos-user-1', teamId, {
      requireUserByWorkosUserId,
      requireMembership,
    })

    expect(result.actor._id).toBe(actor._id)
    expect(result.membership._id).toBe(membership._id)
    expect(requireUserByWorkosUserId).toHaveBeenCalledWith(db, 'workos-user-1')
    expect(requireMembership).toHaveBeenCalledWith(db, teamId, actor._id)
  })

  it('enforces team membership before analytics reads', async () => {
    const teamId = asId<'teams'>('team-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId,
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {} as unknown as QueryCtx['db']

    const result = await requireActorTeamMemberForAnalytics(db, 'workos-user-1', teamId, {
      requireUserByWorkosUserId,
      requireMembership,
    })

    expect(result._id).toBe(actor._id)
    expect(requireUserByWorkosUserId).toHaveBeenCalledWith(db, 'workos-user-1')
    expect(requireMembership).toHaveBeenCalledWith(db, teamId, actor._id)
  })

  it('fails when post does not exist for comment draft access', async () => {
    const postId = asId<'posts'>('post-1')
    const actor = {
      _id: asId<'users'>('user-1'),
    } as unknown as Doc<'users'>
    const membership = {
      _id: asId<'teamMemberships'>('membership-1'),
      teamId: asId<'teams'>('team-1'),
      userId: actor._id,
    } as unknown as Doc<'teamMemberships'>

    const requireUserByWorkosUserId = vi.fn(async () => actor)
    const requireMembership = vi.fn(async () => membership)
    const db = {
      get: vi.fn(async () => null),
    } as unknown as QueryCtx['db']

    await expect(() =>
      requireActorPostMember(db, 'workos-user-1', postId, {
        requireUserByWorkosUserId,
        requireMembership,
      }),
    ).rejects.toThrow('Post not found.')

    expect(requireMembership).not.toHaveBeenCalled()
  })
})
