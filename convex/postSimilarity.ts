import type { Doc, Id } from './_generated/dataModel'
import { normalizeText } from './model'

const similarityTokenPattern = /[a-z0-9]+/g
const dayMs = 24 * 60 * 60 * 1000
const recencyDecayDays = 45
const recencyBoostMax = 0.18
const overlapWeight = 0.82

export const defaultSimilarPostLimit = 5
export const maxSimilarPostLimit = 10
export const similarIncidentWarningThreshold = 0.65

export type SimilarityDraftInput = {
  title?: string
  occurrenceWhere?: string
  occurrenceWhen?: string
  description?: string
}

export type SimilarPostCandidate = Pick<
  Doc<'posts'>,
  | '_id'
  | 'teamId'
  | 'title'
  | 'occurrenceWhere'
  | 'occurrenceWhen'
  | 'description'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'lastActivityAt'
>

export type SimilarPostMatch = {
  postId: Id<'posts'>
  teamId: Id<'teams'>
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  status: Doc<'posts'>['status']
  updatedAt: number
  score: number
  reasons: string[]
}

type SimilarityBreakdown = {
  score: number
  tokenOverlap: number
  sharedTokenCount: number
  unionTokenCount: number
  recencyBoost: number
  ageDays: number
}

type RankedMatch = {
  match: SimilarPostMatch
  tokenOverlap: number
  recencyBoost: number
  lastActivityAt: number
  createdAt: number
}

export function buildSimilarityInputText(input: SimilarityDraftInput): string {
  return normalizeText(
    [input.title, input.occurrenceWhere, input.occurrenceWhen, input.description]
      .filter((value): value is string => Boolean(value))
      .join(' '),
  )
}

export function clampSimilarPostLimit(requestedLimit: number | undefined): number {
  if (typeof requestedLimit !== 'number' || !Number.isFinite(requestedLimit)) {
    return defaultSimilarPostLimit
  }

  return Math.min(maxSimilarPostLimit, Math.max(1, Math.trunc(requestedLimit)))
}

export function rankSimilarPosts(args: {
  draft: SimilarityDraftInput
  candidates: SimilarPostCandidate[]
  now: number
  limit?: number
  excludePostId?: Id<'posts'>
}): SimilarPostMatch[] {
  const inputText = buildSimilarityInputText(args.draft)

  if (!inputText) {
    return []
  }

  const draftTokens = tokenizeSimilarityText(inputText)

  if (draftTokens.size === 0) {
    return []
  }

  const ranked: RankedMatch[] = []

  for (const candidate of args.candidates) {
    if (args.excludePostId && candidate._id === args.excludePostId) {
      continue
    }

    const candidateText = buildSimilarityInputText(candidate)
    const candidateTokens = tokenizeSimilarityText(candidateText)

    if (candidateTokens.size === 0) {
      continue
    }

    const breakdown = scoreSimilarity({
      draftTokens,
      candidateTokens,
      candidateLastActivityAt: candidate.lastActivityAt,
      now: args.now,
    })

    if (!breakdown || breakdown.sharedTokenCount === 0) {
      continue
    }

    ranked.push({
      match: {
        postId: candidate._id,
        teamId: candidate.teamId,
        title: candidate.title,
        occurrenceWhere: candidate.occurrenceWhere,
        occurrenceWhen: candidate.occurrenceWhen,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
        score: breakdown.score,
        reasons: [
          `Token overlap ${String(Math.round(breakdown.tokenOverlap * 100))}% (${String(
            breakdown.sharedTokenCount,
          )}/${String(breakdown.unionTokenCount)} shared tokens)`,
          `Recent activity ${formatAgeDays(breakdown.ageDays)} ago (+${breakdown.recencyBoost.toFixed(3)})`,
        ],
      },
      tokenOverlap: breakdown.tokenOverlap,
      recencyBoost: breakdown.recencyBoost,
      lastActivityAt: candidate.lastActivityAt,
      createdAt: candidate.createdAt,
    })
  }

  ranked.sort((left, right) => {
    if (right.match.score !== left.match.score) {
      return right.match.score - left.match.score
    }

    if (right.tokenOverlap !== left.tokenOverlap) {
      return right.tokenOverlap - left.tokenOverlap
    }

    if (right.recencyBoost !== left.recencyBoost) {
      return right.recencyBoost - left.recencyBoost
    }

    if (right.lastActivityAt !== left.lastActivityAt) {
      return right.lastActivityAt - left.lastActivityAt
    }

    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt
    }

    return String(left.match.postId).localeCompare(String(right.match.postId))
  })

  return ranked
    .slice(0, clampSimilarPostLimit(args.limit))
    .map((entry) => entry.match)
}

function tokenizeSimilarityText(value: string): Set<string> {
  const tokens = normalizeText(value).toLowerCase().match(similarityTokenPattern) ?? []
  return new Set(tokens)
}

function scoreSimilarity(args: {
  draftTokens: Set<string>
  candidateTokens: Set<string>
  candidateLastActivityAt: number
  now: number
}): SimilarityBreakdown | null {
  const sharedTokenCount = countSharedTokens(args.draftTokens, args.candidateTokens)

  if (sharedTokenCount === 0) {
    return null
  }

  const unionTokenCount = args.draftTokens.size + args.candidateTokens.size - sharedTokenCount
  const tokenOverlap = unionTokenCount > 0 ? sharedTokenCount / unionTokenCount : 0
  const ageDays = Math.max(0, (args.now - args.candidateLastActivityAt) / dayMs)
  const freshnessFactor = Math.max(0, 1 - ageDays / recencyDecayDays)
  const recencyBoost = roundScore(freshnessFactor * recencyBoostMax)
  const score = roundScore(Math.min(1, tokenOverlap * overlapWeight + recencyBoost))

  return {
    score,
    tokenOverlap: roundScore(tokenOverlap),
    sharedTokenCount,
    unionTokenCount,
    recencyBoost,
    ageDays,
  }
}

function countSharedTokens(left: Set<string>, right: Set<string>): number {
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left]
  let matches = 0

  for (const token of smaller) {
    if (larger.has(token)) {
      matches += 1
    }
  }

  return matches
}

function formatAgeDays(value: number): string {
  if (value < 1) {
    return '<1d'
  }

  return `${String(Math.floor(value))}d`
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
