import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireUserByWorkosUserId } from './auth'
import {
  instructionAuthorshipModeValidator,
  instructionStatusValidator,
  instructionTargetKindValidator,
  limits,
  normalizeText,
} from './model'
import {
  buildInstructionFileName,
  createAngularInstructionDocument,
  instructionSectionDefinitions,
  parseInstructionMarkdown,
  serializeInstructionMarkdown,
  type InstructionDocument,
  type InstructionNode,
} from '../src/features/instructions/document'

const instructionNodeValidator = v.object({
  id: v.string(),
  title: v.string(),
  summary: v.string(),
  paths: v.array(v.string()),
  rules: v.array(v.string()),
  examples: v.array(v.string()),
  relationships: v.array(v.string()),
})

const instructionDocumentValidator = v.object({
  overview: v.object({
    goal: v.string(),
    repoContext: v.string(),
    targetContext: v.string(),
    sourceSummary: v.string(),
  }),
  structureNodes: v.array(instructionNodeValidator),
  patternNodes: v.array(instructionNodeValidator),
  namingNodes: v.array(instructionNodeValidator),
  dataHandlingNodes: v.array(instructionNodeValidator),
  libraryNodes: v.array(instructionNodeValidator),
  guardrailNodes: v.array(instructionNodeValidator),
  reviewChecklist: v.array(v.string()),
})

const instructionSummaryValidator = v.object({
  instructionId: v.id('instructionDocuments'),
  title: v.string(),
  repoUrl: v.string(),
  targetKind: instructionTargetKindValidator,
  targetName: v.string(),
  referenceLibrary: v.literal('angular'),
  referenceVersion: v.string(),
  status: instructionStatusValidator,
  authorshipMode: instructionAuthorshipModeValidator,
  markdownFileName: v.string(),
  updatedAt: v.number(),
  sectionCounts: v.object({
    structure: v.number(),
    patterns: v.number(),
    naming: v.number(),
    dataHandling: v.number(),
    libraries: v.number(),
    guardrails: v.number(),
  }),
})

const instructionDetailValidator = v.object({
  instructionId: v.id('instructionDocuments'),
  title: v.string(),
  repoUrl: v.string(),
  targetKind: instructionTargetKindValidator,
  targetName: v.string(),
  referenceLibrary: v.literal('angular'),
  referenceVersion: v.string(),
  status: instructionStatusValidator,
  authorshipMode: instructionAuthorshipModeValidator,
  markdownFileName: v.string(),
  markdownContent: v.string(),
  document: instructionDocumentValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

function normalizeBoundedText(label: string, value: string, maxLength: number): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new ConvexError(`${label} is required.`)
  }

  if (normalized.length > maxLength) {
    throw new ConvexError(`${label} must be ${String(maxLength)} characters or fewer.`)
  }

  return normalized
}

function normalizeRepoUrl(value: string): string {
  const normalized = normalizeBoundedText('Repository URL', value, limits.maxInstructionRepoUrlLength)

  if (/\s/.test(normalized)) {
    throw new ConvexError('Repository URL must not contain spaces.')
  }

  return normalized
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeList(label: string, values: string[], maxItems: number): string[] {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)

  if (normalized.length > maxItems) {
    throw new ConvexError(`${label} supports at most ${String(maxItems)} entries.`)
  }

  for (const entry of normalized) {
    if (entry.length > limits.maxInstructionListItemLength) {
      throw new ConvexError(
        `${label} entries must be ${String(limits.maxInstructionListItemLength)} characters or fewer.`,
      )
    }
  }

  return normalized
}

function normalizeNode(label: string, node: InstructionNode, index: number): InstructionNode | null {
  const title = normalizeText(node.title)
  const summary = normalizeText(node.summary)
  const paths = normalizeList(`${label} paths`, node.paths, limits.maxInstructionListItemsPerNode)
  const rules = normalizeList(`${label} rules`, node.rules, limits.maxInstructionListItemsPerNode)
  const examples = normalizeList(
    `${label} examples`,
    node.examples,
    limits.maxInstructionListItemsPerNode,
  )
  const relationships = normalizeList(
    `${label} relationships`,
    node.relationships,
    limits.maxInstructionListItemsPerNode,
  )

  if (!title && !summary && paths.length === 0 && rules.length === 0 && examples.length === 0 && relationships.length === 0) {
    return null
  }

  if (!title) {
    throw new ConvexError(`${label} title is required.`)
  }

  if (!summary) {
    throw new ConvexError(`${label} summary is required.`)
  }

  if (title.length > limits.maxInstructionNodeTitleLength) {
    throw new ConvexError(
      `${label} title must be ${String(limits.maxInstructionNodeTitleLength)} characters or fewer.`,
    )
  }

  if (summary.length > limits.maxInstructionNodeSummaryLength) {
    throw new ConvexError(
      `${label} summary must be ${String(limits.maxInstructionNodeSummaryLength)} characters or fewer.`,
    )
  }

  return {
    id: slugify(node.id || title) || `node-${String(index + 1)}`,
    title,
    summary,
    paths,
    rules,
    examples,
    relationships,
  }
}

function normalizeDocument(document: InstructionDocument): InstructionDocument {
  const overview = {
    goal: normalizeBoundedText('Overview goal', document.overview.goal, limits.maxInstructionOverviewLength),
    repoContext: normalizeBoundedText(
      'Overview repo context',
      document.overview.repoContext,
      limits.maxInstructionOverviewLength,
    ),
    targetContext: normalizeBoundedText(
      'Overview target context',
      document.overview.targetContext,
      limits.maxInstructionOverviewLength,
    ),
    sourceSummary: normalizeBoundedText(
      'Overview source summary',
      document.overview.sourceSummary,
      limits.maxInstructionOverviewLength,
    ),
  }

  const normalizedSections = Object.fromEntries(
    instructionSectionDefinitions.map((section) => {
      const entries = document[section.key]

      if (entries.length > limits.maxInstructionNodeItems) {
        throw new ConvexError(
          `${section.title} supports at most ${String(limits.maxInstructionNodeItems)} entries.`,
        )
      }

      return [
        section.key,
        entries
          .map((node, index) => normalizeNode(section.title, node, index))
          .filter((node): node is InstructionNode => Boolean(node)),
      ]
    }),
  ) as Pick<
    InstructionDocument,
    | 'structureNodes'
    | 'patternNodes'
    | 'namingNodes'
    | 'dataHandlingNodes'
    | 'libraryNodes'
    | 'guardrailNodes'
  >

  const reviewChecklist = normalizeList(
    'Review checklist',
    document.reviewChecklist,
    limits.maxInstructionChecklistItems,
  )

  return {
    overview,
    structureNodes: normalizedSections.structureNodes,
    patternNodes: normalizedSections.patternNodes,
    namingNodes: normalizedSections.namingNodes,
    dataHandlingNodes: normalizedSections.dataHandlingNodes,
    libraryNodes: normalizedSections.libraryNodes,
    guardrailNodes: normalizedSections.guardrailNodes,
    reviewChecklist,
  }
}

function ensureInstructionOwner(
  instruction: Doc<'instructionDocuments'> | null,
  actorUserId: Id<'users'>,
): Doc<'instructionDocuments'> {
  if (!instruction) {
    throw new ConvexError('Instruction not found.')
  }

  if (instruction.userId !== actorUserId) {
    throw new ConvexError('You do not have access to this instruction.')
  }

  return instruction
}

function buildInstructionSummary(instruction: Doc<'instructionDocuments'>) {
  return {
    instructionId: instruction._id,
    title: instruction.title,
    repoUrl: instruction.repoUrl,
    targetKind: instruction.targetKind,
    targetName: instruction.targetName,
    referenceLibrary: instruction.referenceLibrary,
    referenceVersion: instruction.referenceVersion,
    status: instruction.status,
    authorshipMode: instruction.authorshipMode,
    markdownFileName: instruction.markdownFileName,
    updatedAt: instruction.updatedAt,
    sectionCounts: {
      structure: instruction.document.structureNodes.length,
      patterns: instruction.document.patternNodes.length,
      naming: instruction.document.namingNodes.length,
      dataHandling: instruction.document.dataHandlingNodes.length,
      libraries: instruction.document.libraryNodes.length,
      guardrails: instruction.document.guardrailNodes.length,
    },
  }
}

function buildInstructionDetail(instruction: Doc<'instructionDocuments'>) {
  return {
    instructionId: instruction._id,
    title: instruction.title,
    repoUrl: instruction.repoUrl,
    targetKind: instruction.targetKind,
    targetName: instruction.targetName,
    referenceLibrary: instruction.referenceLibrary,
    referenceVersion: instruction.referenceVersion,
    status: instruction.status,
    authorshipMode: instruction.authorshipMode,
    markdownFileName: instruction.markdownFileName,
    markdownContent: instruction.markdownContent,
    document: instruction.document,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  }
}

export const listMyInstructions = query({
  args: {
    actorWorkosUserId: v.string(),
  },
  returns: v.array(instructionSummaryValidator),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const instructions = await ctx.db
      .query('instructionDocuments')
      .withIndex('by_user_updated_at', (q) => q.eq('userId', actor._id))
      .order('desc')
      .collect()

    return instructions.map(buildInstructionSummary)
  },
})

export const getInstructionDetail = query({
  args: {
    actorWorkosUserId: v.string(),
    instructionId: v.id('instructionDocuments'),
  },
  returns: v.union(instructionDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const instruction = await ctx.db.get(args.instructionId)

    if (!instruction || instruction.userId !== actor._id) {
      return null
    }

    return buildInstructionDetail(instruction)
  },
})

export const createInstruction = mutation({
  args: {
    actorWorkosUserId: v.string(),
    title: v.string(),
    repoUrl: v.string(),
    targetKind: instructionTargetKindValidator,
    targetName: v.string(),
    authorshipMode: v.optional(instructionAuthorshipModeValidator),
  },
  returns: instructionDetailValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const title = normalizeBoundedText('Title', args.title, limits.maxInstructionTitleLength)
    const repoUrl = normalizeRepoUrl(args.repoUrl)
    const targetName = normalizeBoundedText(
      'Target name',
      args.targetName,
      limits.maxInstructionTargetNameLength,
    )
    const document = normalizeDocument(
      createAngularInstructionDocument({
        title,
        repoUrl,
        targetKind: args.targetKind,
        targetName,
      }),
    )
    const authorshipMode = args.authorshipMode ?? 'manual'
    const markdownFileName = buildInstructionFileName(title, args.targetKind, targetName)
    const markdownContent = serializeInstructionMarkdown({
      metadata: {
        title,
        referenceLibrary: 'angular',
        referenceVersion: '21',
        repoUrl,
        targetKind: args.targetKind,
        targetName,
        markdownFileName,
        status: 'draft',
        authorshipMode,
      },
      document,
    })

    if (markdownContent.length > limits.maxInstructionMarkdownLength) {
      throw new ConvexError('Generated markdown is too large to save.')
    }

    const now = Date.now()
    const instructionId = await ctx.db.insert('instructionDocuments', {
      userId: actor._id,
      title,
      repoUrl,
      targetKind: args.targetKind,
      targetName,
      referenceLibrary: 'angular',
      referenceVersion: '21',
      status: 'draft',
      authorshipMode,
      markdownFileName,
      markdownContent,
      document,
      createdAt: now,
      updatedAt: now,
    })

    const instruction = await ctx.db.get(instructionId)

    if (!instruction) {
      throw new ConvexError('Instruction could not be loaded after creation.')
    }

    return buildInstructionDetail(instruction)
  },
})

export const updateInstruction = mutation({
  args: {
    actorWorkosUserId: v.string(),
    instructionId: v.id('instructionDocuments'),
    title: v.string(),
    repoUrl: v.string(),
    targetKind: instructionTargetKindValidator,
    targetName: v.string(),
    status: instructionStatusValidator,
    authorshipMode: instructionAuthorshipModeValidator,
    document: instructionDocumentValidator,
  },
  returns: instructionDetailValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const instruction = ensureInstructionOwner(await ctx.db.get(args.instructionId), actor._id)
    const title = normalizeBoundedText('Title', args.title, limits.maxInstructionTitleLength)
    const repoUrl = normalizeRepoUrl(args.repoUrl)
    const targetName = normalizeBoundedText(
      'Target name',
      args.targetName,
      limits.maxInstructionTargetNameLength,
    )
    const document = normalizeDocument(args.document)
    const markdownFileName = buildInstructionFileName(title, args.targetKind, targetName)
    const markdownContent = serializeInstructionMarkdown({
      metadata: {
        title,
        referenceLibrary: 'angular',
        referenceVersion: instruction.referenceVersion,
        repoUrl,
        targetKind: args.targetKind,
        targetName,
        markdownFileName,
        status: args.status,
        authorshipMode: args.authorshipMode,
      },
      document,
    })

    if (markdownContent.length > limits.maxInstructionMarkdownLength) {
      throw new ConvexError('Generated markdown is too large to save.')
    }

    const updatedAt = Date.now()

    await ctx.db.patch(instruction._id, {
      title,
      repoUrl,
      targetKind: args.targetKind,
      targetName,
      status: args.status,
      authorshipMode: args.authorshipMode,
      markdownFileName,
      markdownContent,
      document,
      updatedAt,
    })

    const updated = await ctx.db.get(instruction._id)

    if (!updated) {
      throw new ConvexError('Instruction disappeared during update.')
    }

    return buildInstructionDetail(updated)
  },
})

export const replaceInstructionMarkdown = mutation({
  args: {
    actorWorkosUserId: v.string(),
    instructionId: v.id('instructionDocuments'),
    markdownContent: v.string(),
  },
  returns: instructionDetailValidator,
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const instruction = ensureInstructionOwner(await ctx.db.get(args.instructionId), actor._id)

    if (args.markdownContent.length > limits.maxInstructionMarkdownLength) {
      throw new ConvexError('Markdown content is too large to save.')
    }

    const parsed = parseInstructionMarkdown(args.markdownContent)

    if (!parsed) {
      throw new ConvexError(
        'Markdown does not match the BetterDoc instruction schema. Save a canonical file generated by the app or an agent using the same schema.',
      )
    }

    const title = normalizeBoundedText('Title', parsed.metadata.title, limits.maxInstructionTitleLength)
    const repoUrl = normalizeRepoUrl(parsed.metadata.repoUrl)
    const targetName = normalizeBoundedText(
      'Target name',
      parsed.metadata.targetName,
      limits.maxInstructionTargetNameLength,
    )
    const document = normalizeDocument(parsed.document)
    const markdownFileName =
      normalizeText(parsed.metadata.markdownFileName) ||
      buildInstructionFileName(title, parsed.metadata.targetKind, targetName)
    const markdownContent = serializeInstructionMarkdown({
      metadata: {
        ...parsed.metadata,
        title,
        repoUrl,
        targetName,
        markdownFileName,
      },
      document,
    })
    const updatedAt = Date.now()

    await ctx.db.patch(instruction._id, {
      title,
      repoUrl,
      targetKind: parsed.metadata.targetKind,
      targetName,
      referenceLibrary: parsed.metadata.referenceLibrary,
      referenceVersion: parsed.metadata.referenceVersion,
      status: parsed.metadata.status,
      authorshipMode: parsed.metadata.authorshipMode,
      markdownFileName,
      markdownContent,
      document,
      updatedAt,
    })

    const updated = await ctx.db.get(instruction._id)

    if (!updated) {
      throw new ConvexError('Instruction disappeared during markdown replacement.')
    }

    return buildInstructionDetail(updated)
  },
})

export const deleteInstruction = mutation({
  args: {
    actorWorkosUserId: v.string(),
    instructionId: v.id('instructionDocuments'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireUserByWorkosUserId(ctx.db, args.actorWorkosUserId)
    const instruction = ensureInstructionOwner(await ctx.db.get(args.instructionId), actor._id)

    await ctx.db.delete(instruction._id)

    return null
  },
})
