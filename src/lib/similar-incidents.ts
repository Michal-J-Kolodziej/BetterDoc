const whitespacePattern = /\s+/g

export const similarIncidentsPanelInputMinChars = 20
export const possibleDuplicateScoreThreshold = 0.65

export type SimilarComposerInput = {
  title: string
  occurrenceWhere: string
  occurrenceWhen: string
  description: string
}

export function buildSimilarComposerInput(value: SimilarComposerInput): string {
  return [value.title, value.occurrenceWhere, value.occurrenceWhen, value.description]
    .join(' ')
    .replace(whitespacePattern, ' ')
    .trim()
}

export function shouldShowSimilarIncidentsPanel(value: SimilarComposerInput): boolean {
  return buildSimilarComposerInput(value).length >= similarIncidentsPanelInputMinChars
}

export function shouldShowPossibleDuplicateWarning(
  topScore: number | null | undefined,
): boolean {
  return typeof topScore === 'number' && topScore >= possibleDuplicateScoreThreshold
}
