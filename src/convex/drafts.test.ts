import { describe, expect, it } from 'vitest'

import type { Id, TableNames } from '../../convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import {
  deleteCommentDraftForUser,
  deletePostDraftForUser,
  getCommentDraftForUser,
  getPostDraftForUser,
  upsertCommentDraftForUser,
  upsertPostDraftForUser,
} from '../../convex/drafts'

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>
}

type PostDraftDoc = {
  _id: Id<'postDrafts'>
  userId: Id<'users'>
  teamId: Id<'teams'>
  sourcePostId: Id<'posts'> | null
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  description: string
  imageStorageIds: Id<'_storage'>[]
  createdAt: number
  updatedAt: number
  expiresAt: number
}

type CommentDraftDoc = {
  _id: Id<'commentDrafts'>
  teamId: Id<'teams'>
  postId: Id<'posts'>
  userId: Id<'users'>
  body: string
  imageStorageIds: Id<'_storage'>[]
  createdAt: number
  updatedAt: number
  expiresAt: number
}

type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder
}

class DraftMemoryDb {
  private nextPostDraftId = 1
  private nextCommentDraftId = 1
  private postDrafts = new Map<string, PostDraftDoc>()
  private commentDrafts = new Map<string, CommentDraftDoc>()

  query(table: string) {
    if (table === 'postDrafts') {
      return {
        withIndex: (indexName: string, applyIndex: (builder: EqBuilder) => unknown) => {
          if (indexName !== 'by_user_team_source_post') {
            throw new Error(`Unexpected index: ${indexName}`)
          }

          const conditions: Record<string, unknown> = {}
          const builder = this.createEqBuilder(conditions)
          applyIndex(builder)

          return {
            unique: async () => this.findPostDraft(conditions),
          }
        },
      }
    }

    if (table === 'commentDrafts') {
      return {
        withIndex: (indexName: string, applyIndex: (builder: EqBuilder) => unknown) => {
          if (indexName !== 'by_post_user') {
            throw new Error(`Unexpected index: ${indexName}`)
          }

          const conditions: Record<string, unknown> = {}
          const builder = this.createEqBuilder(conditions)
          applyIndex(builder)

          return {
            unique: async () => this.findCommentDraft(conditions),
          }
        },
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  }

  async get(id: Id<'postDrafts'> | Id<'commentDrafts'> | Id<'posts'>) {
    const key = String(id)

    return this.postDrafts.get(key) ?? this.commentDrafts.get(key) ?? null
  }

  async insert(table: string, value: Omit<PostDraftDoc, '_id'> | Omit<CommentDraftDoc, '_id'>) {
    if (table === 'postDrafts') {
      const draftId = asId<'postDrafts'>(`post-draft-${String(this.nextPostDraftId)}`)
      this.nextPostDraftId += 1

      this.postDrafts.set(String(draftId), {
        _id: draftId,
        ...(value as Omit<PostDraftDoc, '_id'>),
      })

      return draftId
    }

    if (table === 'commentDrafts') {
      const draftId = asId<'commentDrafts'>(`comment-draft-${String(this.nextCommentDraftId)}`)
      this.nextCommentDraftId += 1

      this.commentDrafts.set(String(draftId), {
        _id: draftId,
        ...(value as Omit<CommentDraftDoc, '_id'>),
      })

      return draftId
    }

    throw new Error(`Unexpected table: ${table}`)
  }

  async patch(
    id: Id<'postDrafts'> | Id<'commentDrafts'>,
    value: Partial<Omit<PostDraftDoc, '_id'>> | Partial<Omit<CommentDraftDoc, '_id'>>,
  ) {
    const key = String(id)
    const postDraft = this.postDrafts.get(key)

    if (postDraft) {
      this.postDrafts.set(key, {
        ...postDraft,
        ...(value as Partial<Omit<PostDraftDoc, '_id'>>),
      })
      return
    }

    const commentDraft = this.commentDrafts.get(key)

    if (commentDraft) {
      this.commentDrafts.set(key, {
        ...commentDraft,
        ...(value as Partial<Omit<CommentDraftDoc, '_id'>>),
      })
      return
    }

    throw new Error(`Unknown draft id: ${key}`)
  }

  async delete(id: Id<'postDrafts'> | Id<'commentDrafts'>) {
    const key = String(id)
    this.postDrafts.delete(key)
    this.commentDrafts.delete(key)
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

  private findPostDraft(conditions: Record<string, unknown>): PostDraftDoc | null {
    for (const draft of this.postDrafts.values()) {
      if (
        draft.userId === conditions.userId &&
        draft.teamId === conditions.teamId &&
        draft.sourcePostId === conditions.sourcePostId
      ) {
        return draft
      }
    }

    return null
  }

  private findCommentDraft(conditions: Record<string, unknown>): CommentDraftDoc | null {
    for (const draft of this.commentDrafts.values()) {
      if (draft.postId === conditions.postId && draft.userId === conditions.userId) {
        return draft
      }
    }

    return null
  }
}

function createDraftCtx() {
  const db = new DraftMemoryDb()
  const ctx = { db } as unknown as Pick<MutationCtx, 'db'> & Pick<QueryCtx, 'db'>
  return { ctx }
}

describe('draft autosave lifecycle', () => {
  it('supports post draft upsert/get/delete lifecycle with user isolation', async () => {
    const { ctx } = createDraftCtx()
    const teamId = asId<'teams'>('team-1')
    const userId = asId<'users'>('user-1')
    const otherUserId = asId<'users'>('user-2')

    const first = await upsertPostDraftForUser(ctx, {
      userId,
      teamId,
      sourcePostId: null,
      title: 'Initial',
      occurrenceWhere: 'Dashboard',
      occurrenceWhen: 'Deploy',
      description: 'First draft body',
    })

    const readBack = await getPostDraftForUser(ctx, {
      userId,
      teamId,
      sourcePostId: null,
    })

    expect(readBack?.draftId).toBe(first.draftId)
    expect(readBack?.description).toBe('First draft body')

    const second = await upsertPostDraftForUser(ctx, {
      userId,
      teamId,
      sourcePostId: null,
      title: 'Initial',
      occurrenceWhere: 'Dashboard',
      occurrenceWhen: 'Deploy',
      description: 'Updated draft body',
    })

    expect(second.draftId).toBe(first.draftId)
    expect(second.description).toBe('Updated draft body')

    const blocked = await getPostDraftForUser(ctx, {
      userId: otherUserId,
      teamId,
      sourcePostId: null,
    })

    expect(blocked).toBeNull()

    const deleted = await deletePostDraftForUser(ctx, {
      userId,
      teamId,
      sourcePostId: null,
    })

    expect(deleted.deleted).toBe(true)

    const afterDelete = await getPostDraftForUser(ctx, {
      userId,
      teamId,
      sourcePostId: null,
    })

    expect(afterDelete).toBeNull()
  })

  it('supports comment draft upsert/get/delete lifecycle with user isolation', async () => {
    const { ctx } = createDraftCtx()
    const teamId = asId<'teams'>('team-1')
    const postId = asId<'posts'>('post-1')
    const userId = asId<'users'>('user-1')
    const otherUserId = asId<'users'>('user-2')

    const first = await upsertCommentDraftForUser(ctx, {
      userId,
      teamId,
      postId,
      body: 'First comment draft',
    })

    const readBack = await getCommentDraftForUser(ctx, {
      userId,
      postId,
    })

    expect(readBack?.draftId).toBe(first.draftId)
    expect(readBack?.body).toBe('First comment draft')

    const second = await upsertCommentDraftForUser(ctx, {
      userId,
      teamId,
      postId,
      body: 'Updated comment draft',
    })

    expect(second.draftId).toBe(first.draftId)
    expect(second.body).toBe('Updated comment draft')

    const blocked = await getCommentDraftForUser(ctx, {
      userId: otherUserId,
      postId,
    })

    expect(blocked).toBeNull()

    const deleted = await deleteCommentDraftForUser(ctx, {
      userId,
      postId,
    })

    expect(deleted.deleted).toBe(true)

    const afterDelete = await getCommentDraftForUser(ctx, {
      userId,
      postId,
    })

    expect(afterDelete).toBeNull()
  })
})
