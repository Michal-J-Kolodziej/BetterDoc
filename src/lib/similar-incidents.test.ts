import { describe, expect, it } from 'vitest'

import {
  buildSimilarComposerInput,
  possibleDuplicateScoreThreshold,
  shouldShowPossibleDuplicateWarning,
  shouldShowSimilarIncidentsPanel,
  similarIncidentsPanelInputMinChars,
} from './similar-incidents'

describe('similar incidents composer helpers', () => {
  it('shows the panel only when combined input reaches threshold', () => {
    expect(
      shouldShowSimilarIncidentsPanel({
        title: '1234567890123456789',
        occurrenceWhere: '',
        occurrenceWhen: '',
        description: '',
      }),
    ).toBe(false)

    expect(
      shouldShowSimilarIncidentsPanel({
        title: '12345678901234567890',
        occurrenceWhere: '',
        occurrenceWhen: '',
        description: '',
      }),
    ).toBe(true)
  })

  it('normalizes whitespace when combining fields', () => {
    const combined = buildSimilarComposerInput({
      title: 'Checkout   timeout',
      occurrenceWhere: '   Payments API',
      occurrenceWhen: 'During   deploy',
      description: '  users  blocked ',
    })

    expect(combined).toBe('Checkout timeout Payments API During deploy users blocked')
    expect(combined.length).toBeGreaterThanOrEqual(similarIncidentsPanelInputMinChars)
  })

  it('applies warning threshold at 0.65+', () => {
    expect(shouldShowPossibleDuplicateWarning(null)).toBe(false)
    expect(shouldShowPossibleDuplicateWarning(possibleDuplicateScoreThreshold - 0.001)).toBe(false)
    expect(shouldShowPossibleDuplicateWarning(possibleDuplicateScoreThreshold)).toBe(true)
    expect(shouldShowPossibleDuplicateWarning(0.9)).toBe(true)
  })
})
