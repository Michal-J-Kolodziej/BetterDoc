import { v } from 'convex/values'

export const teamRoles = ['admin', 'teamleader', 'senior', 'mid', 'junior'] as const
export type TeamRole = (typeof teamRoles)[number]

export const inviteStatuses = ['pending', 'accepted', 'declined', 'revoked'] as const
export type InviteStatus = (typeof inviteStatuses)[number]

export const postStatuses = ['active', 'archived'] as const
export type PostStatus = (typeof postStatuses)[number]

export const teamRoleValidator = v.union(
  v.literal('admin'),
  v.literal('teamleader'),
  v.literal('senior'),
  v.literal('mid'),
  v.literal('junior'),
)

export const inviteStatusValidator = v.union(
  v.literal('pending'),
  v.literal('accepted'),
  v.literal('declined'),
  v.literal('revoked'),
)

export const postStatusValidator = v.union(v.literal('active'), v.literal('archived'))

export const fileContentTypeValidator = v.union(
  v.literal('image/jpeg'),
  v.literal('image/png'),
  v.literal('image/webp'),
)

export const limits = {
  iidPrefix: 'BD',
  iidRandomLength: 8,
  maxNameLength: 80,
  maxTeamNameLength: 80,
  maxPostTitleLength: 120,
  maxOccurrenceLength: 140,
  maxPostDescriptionLength: 5000,
  maxPostImages: 6,
  maxCommentLength: 2000,
  maxCommentImages: 4,
  maxUploadSizeBytes: 10 * 1024 * 1024,
  inviteDurationMs: 14 * 24 * 60 * 60 * 1000,
} as const

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
