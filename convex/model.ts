import { v } from 'convex/values'

export const teamRoles = ['admin', 'teamleader', 'senior', 'mid', 'junior'] as const
export type TeamRole = (typeof teamRoles)[number]

export const inviteStatuses = ['pending', 'accepted', 'declined', 'revoked'] as const
export type InviteStatus = (typeof inviteStatuses)[number]

export const postStatuses = ['active', 'resolved', 'archived'] as const
export type PostStatus = (typeof postStatuses)[number]

export const notificationTypes = [
  'invite_received',
  'comment_on_post',
  'mention_in_post',
  'mention_in_comment',
] as const
export type NotificationType = (typeof notificationTypes)[number]

export const instructionReferenceLibraries = ['angular'] as const
export type InstructionReferenceLibrary = (typeof instructionReferenceLibraries)[number]

export const instructionTargetKinds = ['project', 'library'] as const
export type InstructionTargetKind = (typeof instructionTargetKinds)[number]

export const instructionStatuses = ['draft', 'ready'] as const
export type InstructionStatus = (typeof instructionStatuses)[number]

export const instructionAuthorshipModes = ['manual', 'agent'] as const
export type InstructionAuthorshipMode = (typeof instructionAuthorshipModes)[number]

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

export const postStatusValidator = v.union(
  v.literal('active'),
  v.literal('resolved'),
  v.literal('archived'),
)

export const notificationTypeValidator = v.union(
  v.literal('invite_received'),
  v.literal('comment_on_post'),
  v.literal('mention_in_post'),
  v.literal('mention_in_comment'),
)

export const instructionReferenceLibraryValidator = v.literal('angular')

export const instructionTargetKindValidator = v.union(
  v.literal('project'),
  v.literal('library'),
)

export const instructionStatusValidator = v.union(v.literal('draft'), v.literal('ready'))

export const instructionAuthorshipModeValidator = v.union(
  v.literal('manual'),
  v.literal('agent'),
)

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
  maxTemplateNameLength: 80,
  maxPostTitleLength: 120,
  maxOccurrenceLength: 140,
  maxPostDescriptionLength: 5000,
  maxResolutionSummaryLength: 3000,
  maxPostImages: 6,
  maxCommentLength: 2000,
  maxCommentImages: 4,
  maxEmailLength: 320,
  maxUploadSizeBytes: 10 * 1024 * 1024,
  inviteDurationMs: 14 * 24 * 60 * 60 * 1000,
  inviteLinkMaxUses: 25,
  draftRetentionMs: 30 * 24 * 60 * 60 * 1000,
  maxInstructionTitleLength: 120,
  maxInstructionRepoUrlLength: 500,
  maxInstructionTargetNameLength: 120,
  maxInstructionOverviewLength: 1200,
  maxInstructionNodeTitleLength: 140,
  maxInstructionNodeSummaryLength: 1600,
  maxInstructionNodeItems: 16,
  maxInstructionListItemsPerNode: 12,
  maxInstructionListItemLength: 240,
  maxInstructionChecklistItems: 12,
  maxInstructionMarkdownLength: 60000,
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

export function resolveDraftExpiresAt(
  now: number,
  requestedExpiresAt: number | null | undefined,
): number {
  if (
    typeof requestedExpiresAt === 'number' &&
    Number.isFinite(requestedExpiresAt) &&
    requestedExpiresAt > now
  ) {
    return requestedExpiresAt
  }

  return now + limits.draftRetentionMs
}
