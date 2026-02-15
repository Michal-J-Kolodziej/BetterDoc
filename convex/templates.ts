import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireMembership, requireUserByWorkosUserId } from './auth'
import { limits, normalizeText } from './model'

type DbLike = QueryCtx['db'] | MutationCtx['db']

type TeamAccessDeps = {
  requireUserByWorkosUserId: typeof requireUserByWorkosUserId
  requireMembership: typeof requireMembership
}

const defaultTeamAccessDeps: TeamAccessDeps = {
  requireUserByWorkosUserId,
  requireMembership,
}

const templateViewValidator = v.object({
  templateId: v.id('postTemplates'),
  teamId: v.id('teams'),
  name: v.string(),
  title: v.string(),
  occurrenceWhere: v.string(),
  occurrenceWhen: v.string(),
  description: v.string(),
  createdByUserId: v.id('users'),
  updatedByUserId: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function normalizeTemplateName(value: string): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new ConvexError('Template name is required.')
  }

  if (normalized.length > limits.maxTemplateNameLength) {
    throw new ConvexError(
      `Template name must be ${String(limits.maxTemplateNameLength)} characters or fewer.`,
    )
  }

  return normalized
}

function normalizeTemplateField(value: string, fieldLabel: string, maxLength: number): string {
  if (value.length > maxLength) {
    throw new ConvexError(`${fieldLabel} must be ${String(maxLength)} characters or fewer.`)
  }

  return value
}

function toTemplateView(template: Doc<'postTemplates'>) {
  return {
    templateId: template._id,
    teamId: template.teamId,
    name: template.name,
    title: template.title,
    occurrenceWhere: template.occurrenceWhere,
    occurrenceWhen: template.occurrenceWhen,
    description: template.description,
    createdByUserId: template.createdByUserId,
    updatedByUserId: template.updatedByUserId,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export async function requireActorTeamMember(
  db: DbLike,
  actorWorkosUserId: string,
  teamId: Id<'teams'>,
  deps: TeamAccessDeps = defaultTeamAccessDeps,
): Promise<Doc<'users'>> {
  const actor = await deps.requireUserByWorkosUserId(db, actorWorkosUserId)
  await deps.requireMembership(db, teamId, actor._id)
  return actor
}

export const listTeamTemplates = query({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
  },
  returns: v.array(templateViewValidator),
  handler: async (ctx, args) => {
    await requireActorTeamMember(ctx.db, args.actorWorkosUserId, args.teamId)

    const templates = await ctx.db
      .query('postTemplates')
      .withIndex('by_team_updated_at', (query) => query.eq('teamId', args.teamId))
      .order('desc')
      .collect()

    return templates.map(toTemplateView)
  },
})

export const createTemplate = mutation({
  args: {
    actorWorkosUserId: v.string(),
    teamId: v.id('teams'),
    name: v.string(),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
  },
  returns: templateViewValidator,
  handler: async (ctx, args) => {
    const actor = await requireActorTeamMember(ctx.db, args.actorWorkosUserId, args.teamId)
    const now = Date.now()

    const templateId = await ctx.db.insert('postTemplates', {
      teamId: args.teamId,
      name: normalizeTemplateName(args.name),
      title: normalizeTemplateField(args.title, 'Title', limits.maxPostTitleLength),
      occurrenceWhere: normalizeTemplateField(
        args.occurrenceWhere,
        'Occurrence where',
        limits.maxOccurrenceLength,
      ),
      occurrenceWhen: normalizeTemplateField(
        args.occurrenceWhen,
        'Occurrence when',
        limits.maxOccurrenceLength,
      ),
      description: normalizeTemplateField(
        args.description,
        'Issue description',
        limits.maxPostDescriptionLength,
      ),
      createdByUserId: actor._id,
      updatedByUserId: actor._id,
      createdAt: now,
      updatedAt: now,
    })

    const template = await ctx.db.get(templateId)

    if (!template) {
      throw new ConvexError('Template could not be loaded.')
    }

    return toTemplateView(template)
  },
})

export const updateTemplate = mutation({
  args: {
    actorWorkosUserId: v.string(),
    templateId: v.id('postTemplates'),
    name: v.string(),
    title: v.string(),
    occurrenceWhere: v.string(),
    occurrenceWhen: v.string(),
    description: v.string(),
  },
  returns: templateViewValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const template = await ctx.db.get(args.templateId)

    if (!template) {
      throw new ConvexError('Template not found.')
    }

    await requireMembership(ctx.db, template.teamId, actor._id)

    await ctx.db.patch(template._id, {
      name: normalizeTemplateName(args.name),
      title: normalizeTemplateField(args.title, 'Title', limits.maxPostTitleLength),
      occurrenceWhere: normalizeTemplateField(
        args.occurrenceWhere,
        'Occurrence where',
        limits.maxOccurrenceLength,
      ),
      occurrenceWhen: normalizeTemplateField(
        args.occurrenceWhen,
        'Occurrence when',
        limits.maxOccurrenceLength,
      ),
      description: normalizeTemplateField(
        args.description,
        'Issue description',
        limits.maxPostDescriptionLength,
      ),
      updatedByUserId: actor._id,
      updatedAt: Date.now(),
    })

    const refreshed = await ctx.db.get(template._id)

    if (!refreshed) {
      throw new ConvexError('Template could not be loaded.')
    }

    return toTemplateView(refreshed)
  },
})

export const deleteTemplate = mutation({
  args: {
    actorWorkosUserId: v.string(),
    templateId: v.id('postTemplates'),
  },
  returns: v.object({
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const template = await ctx.db.get(args.templateId)

    if (!template) {
      return { deleted: false }
    }

    await requireMembership(ctx.db, template.teamId, actor._id)
    await ctx.db.delete(template._id)

    return { deleted: true }
  },
})
