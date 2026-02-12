export type TipEditorFormState = {
  symptom: string
  rootCause: string
  fix: string
  prevention: string
  tags: string
  references: string
}

export type TipDraftPayload = {
  symptom: string
  rootCause: string
  fix: string
  prevention: string
  tags: string[]
  references: string[]
}

export type TipEditorValidationErrors = Partial<
  Record<keyof TipEditorFormState, string>
>

const textFieldLimits: Record<
  keyof Pick<TipEditorFormState, 'symptom' | 'rootCause' | 'fix' | 'prevention'>,
  number
> = {
  symptom: 280,
  rootCause: 8000,
  fix: 8000,
  prevention: 8000,
}

const listLimits = {
  tags: { maxItems: 20, maxLength: 48 },
  references: { maxItems: 20, maxLength: 320 },
} as const

const requiredFieldLabels: Record<
  keyof Pick<TipEditorFormState, 'symptom' | 'rootCause' | 'fix' | 'prevention'>,
  string
> = {
  symptom: 'Symptom',
  rootCause: 'Root cause',
  fix: 'Fix',
  prevention: 'Prevention',
}

export function createEmptyTipEditorState(): TipEditorFormState {
  return {
    symptom: '',
    rootCause: '',
    fix: '',
    prevention: '',
    tags: '',
    references: '',
  }
}

function splitListField(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeList(values: string[], maxItems: number, maxLength: number): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (value.length > maxLength) {
      throw new Error(`Entries must be ${maxLength} characters or fewer.`)
    }

    const dedupeKey = value.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }

    normalized.push(value)
    seen.add(dedupeKey)

    if (normalized.length > maxItems) {
      throw new Error(`Only ${maxItems} entries are allowed.`)
    }
  }

  return normalized
}

export function validateTipEditorForm(
  state: TipEditorFormState,
): TipEditorValidationErrors {
  const errors: TipEditorValidationErrors = {}

  for (const [field, label] of Object.entries(requiredFieldLabels) as Array<
    [keyof typeof requiredFieldLabels, string]
  >) {
    const trimmed = state[field].trim()
    if (!trimmed) {
      errors[field] = `${label} is required.`
      continue
    }

    if (trimmed.length > textFieldLimits[field]) {
      errors[field] = `${label} must be ${textFieldLimits[field]} characters or fewer.`
    }
  }

  const tags = splitListField(state.tags)
  const references = splitListField(state.references)

  try {
    normalizeList(tags, listLimits.tags.maxItems, listLimits.tags.maxLength)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid tags.'
    errors.tags = message
  }

  try {
    normalizeList(
      references,
      listLimits.references.maxItems,
      listLimits.references.maxLength,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid references.'
    errors.references = message
  }

  return errors
}

export function buildTipDraftPayload(state: TipEditorFormState): {
  payload: TipDraftPayload | null
  errors: TipEditorValidationErrors
} {
  const errors = validateTipEditorForm(state)
  if (Object.keys(errors).length > 0) {
    return {
      payload: null,
      errors,
    }
  }

  return {
    payload: {
      symptom: state.symptom.trim(),
      rootCause: state.rootCause.trim(),
      fix: state.fix.trim(),
      prevention: state.prevention.trim(),
      tags: normalizeList(
        splitListField(state.tags),
        listLimits.tags.maxItems,
        listLimits.tags.maxLength,
      ),
      references: normalizeList(
        splitListField(state.references),
        listLimits.references.maxItems,
        listLimits.references.maxLength,
      ),
    },
    errors: {},
  }
}
