import { Panel } from '@/components/ui/Panel'
import type { TipSearchState, TipSearchStatus } from '@/features/dashboard/types'

type FilteredTip = {
  component: string | null
  currentRevision: number
  id: string
  library: string | null
  project: string | null
  slug: string
  status: string
  tags: string[]
  title: string
}

type SearchPanelProps = {
  canReadTips: boolean
  onClearFilters: () => void
  onSetTipSearchField: <K extends keyof TipSearchState>(
    field: K,
    value: TipSearchState[K],
  ) => void
  results: FilteredTip[] | undefined
  searchError: string | null
  tipSearchState: TipSearchState
}

export function SearchPanel({
  canReadTips,
  onClearFilters,
  onSetTipSearchField,
  results,
  searchError,
  tipSearchState,
}: SearchPanelProps) {
  return (
    <Panel
      description="Indexed discovery across text, project, library, component, tag, and status fields."
      title="Tips Search"
    >
      {!canReadTips ? (
        <p className="text-sm text-amber-200">Permission denied. tips.read is required.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="app-label" htmlFor="tip-search-text">
                Text search
              </label>
              <input
                className="app-input"
                id="tip-search-text"
                onChange={(event) => onSetTipSearchField('searchText', event.target.value)}
                placeholder="race condition callback"
                value={tipSearchState.searchText}
              />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-search-project">
                Project
              </label>
              <input
                className="app-input"
                id="tip-search-project"
                onChange={(event) => onSetTipSearchField('project', event.target.value)}
                placeholder="media-press"
                value={tipSearchState.project}
              />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-search-library">
                Library
              </label>
              <input
                className="app-input"
                id="tip-search-library"
                onChange={(event) => onSetTipSearchField('library', event.target.value)}
                placeholder="billing-core"
                value={tipSearchState.library}
              />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-search-component">
                Component
              </label>
              <input
                className="app-input"
                id="tip-search-component"
                onChange={(event) => onSetTipSearchField('component', event.target.value)}
                placeholder="InvoiceSummary"
                value={tipSearchState.component}
              />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-search-tag">
                Tag
              </label>
              <input
                className="app-input"
                id="tip-search-tag"
                onChange={(event) => onSetTipSearchField('tag', event.target.value)}
                placeholder="react"
                value={tipSearchState.tag}
              />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-search-status">
                Status
              </label>
              <select
                className="app-select"
                id="tip-search-status"
                onChange={(event) =>
                  onSetTipSearchField('status', event.target.value as TipSearchStatus)
                }
                value={tipSearchState.status}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="app-btn-secondary" onClick={onClearFilters} type="button">
              Clear filters
            </button>
          </div>

          {searchError ? <p className="text-sm text-amber-200">Search error: {searchError}</p> : null}
          {!searchError && results === undefined ? (
            <p className="text-sm text-slate-300">Loading indexed results...</p>
          ) : null}
          {!searchError && results?.length === 0 ? (
            <p className="text-sm text-slate-300">No tips match the current filters.</p>
          ) : null}

          {!searchError && results && results.length > 0 ? (
            <ul className="space-y-2">
              {results.map((tip) => (
                <li key={tip.id} className="app-card py-3">
                  <p className="text-sm text-slate-100">
                    <code className="app-code">{tip.slug}</code> {tip.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {tip.status}, r{tip.currentRevision}
                    {tip.project ? ` · project:${tip.project}` : ''}
                    {tip.library ? ` · library:${tip.library}` : ''}
                    {tip.component ? ` · component:${tip.component}` : ''}
                    {tip.tags.length > 0 ? ` · tags:${tip.tags.join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
