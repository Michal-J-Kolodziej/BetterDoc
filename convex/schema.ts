import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  inviteStatusValidator,
  postStatusValidator,
  teamRoleValidator,
} from './model'

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    iid: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_iid', ['iid']),

  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    createdByUserId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_created_by', ['createdByUserId']),

  teamMemberships: defineTable({
    teamId: v.id('teams'),
    userId: v.id('users'),
    role: teamRoleValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_user', ['userId'])
    .index('by_team_user', ['teamId', 'userId']),

  teamInvites: defineTable({
    teamId: v.id('teams'),
    invitedByUserId: v.id('users'),
    invitedUserId: v.id('users'),
    role: teamRoleValidator,
    status: inviteStatusValidator,
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index('by_invited_user_status', ['invitedUserId', 'status'])
    .index('by_team_status', ['teamId', 'status'])
    .index('by_team_invited_user', ['teamId', 'invitedUserId']),

  posts: defineTable({
    teamId: v.id('teams'),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
    imageStorageIds: v.array(v.id('_storage')),
    status: postStatusValidator,
    createdByUserId: v.id('users'),
    updatedByUserId: v.id('users'),
    commentCount: v.number(),
    lastActivityAt: v.number(),
    archivedAt: v.optional(v.number()),
    archivedByUserId: v.optional(v.id('users')),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_team_last_activity', ['teamId', 'lastActivityAt'])
    .index('by_team_status_last_activity', ['teamId', 'status', 'lastActivityAt'])
    .index('by_creator_updated', ['createdByUserId', 'updatedAt'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['teamId', 'status', 'createdByUserId'],
    }),

  comments: defineTable({
    postId: v.id('posts'),
    teamId: v.id('teams'),
    body: v.string(),
    imageStorageIds: v.array(v.id('_storage')),
    createdByUserId: v.id('users'),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedByUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_post_created_at', ['postId', 'createdAt'])
    .index('by_post_updated_at', ['postId', 'updatedAt']),
})
