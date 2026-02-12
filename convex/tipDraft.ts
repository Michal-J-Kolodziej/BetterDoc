import { ConvexError } from 'convex/values'

export const tipDraftLimits = {
  symptomMaxLength: 280,
  bodyFieldMaxLength: 8000,
  titleMaxLength: 160,
  slugMaxLength: 96,
  facetMaxLength: 96,
  maxTags: 20,
  maxTagLength: 48,
  maxReferences: 20,
  maxReferenceLength: 320,
} as const

export type TipDraftInput = {
  symptom: string
  rootCause: string
  fix: string
  prevention: string
  project?: string
  library?: string
  component?: string
  tags: string[]
  references: string[]
}

export type NormalizedTipDraft = {
  symptom: string
  rootCause: string
  fix: string
  prevention: string
  project?: string
  library?: string
  component?: string
  tags: string[]
  references: string[]
}

function requireTrimmedField(
  value: string,
  label: string,
  maxLength: number,
): string {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new ConvexError(`${label} is required.`)
  }

  if (trimmed.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer.`)
  }

  return trimmed
}

function normalizeList(
  values: readonly string[],
  label: string,
  maxItems: number,
  maxItemLength: number,
): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const trimmed = value.trim()

    if (!trimmed) {
      continue
    }

    if (trimmed.length > maxItemLength) {
      throw new ConvexError(
        `${label} entries must be ${maxItemLength} characters or fewer.`,
      )
    }

    const dedupeKey = trimmed.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }

    normalized.push(trimmed)
    seen.add(dedupeKey)

    if (normalized.length > maxItems) {
      throw new ConvexError(`${label} can contain at most ${maxItems} entries.`)
    }
  }

  return normalized
}

function normalizeOptionalField(
  value: string | undefined,
  label: string,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer.`)
  }

  return trimmed
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildTipMetadata(symptom: string, now: number): {
  slug: string
  title: string
} {
  const title =
    symptom.length <= tipDraftLimits.titleMaxLength
      ? symptom
      : `${symptom.slice(0, tipDraftLimits.titleMaxLength - 3)}...`
  const suffix = now.toString(36)
  const rawBase = slugify(symptom) || 'tip'
  const maxBaseLength = Math.max(
    1,
    tipDraftLimits.slugMaxLength - suffix.length - 1,
  )
  const base = rawBase.slice(0, maxBaseLength)

  return {
    slug: `${base}-${suffix}`,
    title,
  }
}

export function normalizeTipDraftInput(
  input: TipDraftInput,
): NormalizedTipDraft {
  const normalized: NormalizedTipDraft = {
    symptom: requireTrimmedField(
      input.symptom,
      'Symptom',
      tipDraftLimits.symptomMaxLength,
    ),
    rootCause: requireTrimmedField(
      input.rootCause,
      'Root cause',
      tipDraftLimits.bodyFieldMaxLength,
    ),
    fix: requireTrimmedField(input.fix, 'Fix', tipDraftLimits.bodyFieldMaxLength),
    prevention: requireTrimmedField(
      input.prevention,
      'Prevention',
      tipDraftLimits.bodyFieldMaxLength,
    ),
    tags: normalizeList(
      input.tags,
      'Tags',
      tipDraftLimits.maxTags,
      tipDraftLimits.maxTagLength,
    ),
    references: normalizeList(
      input.references,
      'References',
      tipDraftLimits.maxReferences,
      tipDraftLimits.maxReferenceLength,
    ),
  }

  const project = normalizeOptionalField(
    input.project,
    'Project',
    tipDraftLimits.facetMaxLength,
  )
  if (project) {
    normalized.project = project
  }

  const library = normalizeOptionalField(
    input.library,
    'Library',
    tipDraftLimits.facetMaxLength,
  )
  if (library) {
    normalized.library = library
  }

  const component = normalizeOptionalField(
    input.component,
    'Component',
    tipDraftLimits.facetMaxLength,
  )
  if (component) {
    normalized.component = component
  }

  return normalized
}

export function buildTipSearchText(
  title: string,
  draft: NormalizedTipDraft,
): string {
  const parts = [
    title,
    draft.symptom,
    draft.rootCause,
    draft.fix,
    draft.prevention,
    draft.project ?? '',
    draft.library ?? '',
    draft.component ?? '',
    ...draft.tags,
    ...draft.references,
  ]

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
