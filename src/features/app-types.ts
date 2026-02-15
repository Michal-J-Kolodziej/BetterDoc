import type { Id } from '../../convex/_generated/dataModel'

export type TeamRole = 'admin' | 'teamleader' | 'senior' | 'mid' | 'junior'
export type PostStatus = 'active' | 'resolved' | 'archived'

export type PostCardViewModel = {
  postId: Id<'posts'>
  teamId: Id<'teams'>
  teamName: string
  teamSlug: string
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  descriptionPreview: string
  status: PostStatus
  createdByUserId: Id<'users'>
  createdByName: string
  createdByIid: string
  imageCount: number
  imageUrls: string[]
  commentCount: number
  lastActivityAt: number
  createdAt: number
  updatedAt: number
}

export type CommentViewModel = {
  commentId: Id<'comments'>
  postId: Id<'posts'>
  body: string
  imageStorageIds: Id<'_storage'>[]
  imageUrls: string[]
  createdByUserId: Id<'users'>
  createdByName: string
  createdByIid: string
  createdAt: number
  updatedAt: number
  editedAt: number | null
  deletedAt: number | null
  canEdit: boolean
  canDelete: boolean
}

export type PostDetailViewModel = {
  postId: Id<'posts'>
  teamId: Id<'teams'>
  teamName: string
  teamSlug: string
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  description: string
  status: PostStatus
  createdByUserId: Id<'users'>
  createdByName: string
  createdByIid: string
  imageStorageIds: Id<'_storage'>[]
  imageUrls: string[]
  resolutionSummary: string | null
  resolvedAt: number | null
  resolvedByUserId: Id<'users'> | null
  resolvedByName: string | null
  resolvedByIid: string | null
  commentCount: number
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  canEdit: boolean
  canArchive: boolean
  canUnarchive: boolean
  canResolve: boolean
  canReopen: boolean
  canPromoteToPlaybook: boolean
  promotedPlaybookId: Id<'playbooks'> | null
  comments: CommentViewModel[]
}
