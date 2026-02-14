import type { Id } from '../../../convex/_generated/dataModel'

export type DashboardTab =
  | 'overview'
  | 'tip-studio'
  | 'workflow'
  | 'search'
  | 'watchlist'
  | 'audit'

export type TipStatus = 'draft' | 'in_review' | 'published' | 'deprecated'
export type TipSearchStatus = 'all' | TipStatus

export type TipSearchState = {
  component: string
  library: string
  project: string
  searchText: string
  status: TipSearchStatus
  tag: string
}

export type TipComponentLink = {
  componentFilePath: string
  componentName: string
  projectName: string
  workspaceId: string
}

export type TipSummaryOption = {
  currentRevision: number
  id: Id<'tips'>
  status: TipStatus
  title: string
}

export const dashboardTabs: ReadonlyArray<{ label: string; value: DashboardTab }> = [
  { label: 'Overview', value: 'overview' },
  { label: 'Tip Studio', value: 'tip-studio' },
  { label: 'Workflow', value: 'workflow' },
  { label: 'Search', value: 'search' },
  { label: 'Watchlist', value: 'watchlist' },
  { label: 'Audit', value: 'audit' },
]

export const searchFieldLimits = {
  component: 96,
  library: 96,
  project: 96,
  tag: 48,
} as const

export function parseDashboardTab(value: unknown): DashboardTab {
  if (typeof value !== 'string') {
    return 'overview'
  }

  if (dashboardTabs.some((tab) => tab.value === value)) {
    return value as DashboardTab
  }

  return 'overview'
}

export function createEmptyTipSearchState(): TipSearchState {
  return {
    searchText: '',
    project: '',
    library: '',
    component: '',
    tag: '',
    status: 'all',
  }
}

export function validateTipSearchState(state: TipSearchState): string | null {
  const projectLength = state.project.trim().length
  if (projectLength > searchFieldLimits.project) {
    return `Project filter must be ${searchFieldLimits.project} characters or fewer.`
  }

  const libraryLength = state.library.trim().length
  if (libraryLength > searchFieldLimits.library) {
    return `Library filter must be ${searchFieldLimits.library} characters or fewer.`
  }

  const componentLength = state.component.trim().length
  if (componentLength > searchFieldLimits.component) {
    return `Component filter must be ${searchFieldLimits.component} characters or fewer.`
  }

  const tagLength = state.tag.trim().length
  if (tagLength > searchFieldLimits.tag) {
    return `Tag filter must be ${searchFieldLimits.tag} characters or fewer.`
  }

  return null
}

export function getTipComponentLinkKey(link: TipComponentLink): string {
  return [
    link.workspaceId.toLowerCase(),
    link.projectName.toLowerCase(),
    link.componentName.toLowerCase(),
    link.componentFilePath.toLowerCase(),
  ].join('::')
}
