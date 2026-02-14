import { Link } from '@tanstack/react-router'

import { Panel } from '@/components/ui/Panel'
import type { TipComponentLink, TipSummaryOption } from '@/features/dashboard/types'
import { getTipComponentLinkKey } from '@/features/dashboard/types'
import type {
  TipEditorFormState,
  TipEditorValidationErrors,
} from '@/lib/tip-editor'

type WorkspaceSummary = {
  graphVersionNumber: number
  workspaceId: string
}

type WorkspaceGraph = {
  projects: Array<{
    componentCount: number
    name: string
    type: string
  }>
}

type ProjectGraph = {
  components: Array<{
    filePath: string
    id: string
    name: string
  }>
  project: {
    name: string
  }
}

type EditorTip = {
  component: string | null
  fix: string
  library: string | null
  prevention: string
  project: string | null
  references: string[]
  rootCause: string
  symptom: string
  tags: string[]
}

type EditorTipComponentLink = {
  componentFilePath: string
  componentName: string
  projectName: string
  workspaceId: string
}

type TipRevision = {
  createdAt: number
  editedByWorkosUserId: string
  revisionId: string
  revisionNumber: number
  status: string
}

type TipStudioPanelProps = {
  canCreateTips: boolean
  canLoadSelectedTip: boolean
  componentWorkspaces: WorkspaceSummary[] | undefined
  draftTipId: string | null
  editorTip: EditorTip | null | undefined
  editorTipComponentLinks: EditorTipComponentLink[] | undefined
  linkComponentId: string
  linkProjectName: string
  linkWorkspaceId: string
  onAddSelectedComponentLink: () => void
  onLoadSelectedTipContent: () => void
  onRemoveComponentLink: (link: TipComponentLink) => void
  onResetToNewDraft: () => void
  onSaveDraft: () => void
  onSelectDraftTip: (nextTipId: string) => void
  onSetEditorField: (field: keyof TipEditorFormState, value: string) => void
  onSetLinkComponentId: (value: string) => void
  onSetLinkProjectName: (value: string) => void
  onSetLinkWorkspaceId: (value: string) => void
  selectedProjectGraph: ProjectGraph | null | undefined
  selectedWorkspaceGraph: WorkspaceGraph | null | undefined
  tipComponentLinks: TipComponentLink[]
  tipComponentMessage: string | null
  tipEditorMessage: string | null
  tipEditorState: TipEditorFormState
  tipRevisions: TipRevision[] | undefined
  tipValidationErrors: TipEditorValidationErrors
  tips: TipSummaryOption[] | undefined
  workspaceToRouteParam: (workspaceId: string) => string
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="mt-1 text-xs font-medium text-rose-200">{message}</p>
}

export function TipStudioPanel({
  canCreateTips,
  canLoadSelectedTip,
  componentWorkspaces,
  draftTipId,
  editorTip,
  editorTipComponentLinks,
  linkComponentId,
  linkProjectName,
  linkWorkspaceId,
  onAddSelectedComponentLink,
  onLoadSelectedTipContent,
  onRemoveComponentLink,
  onResetToNewDraft,
  onSaveDraft,
  onSelectDraftTip,
  onSetEditorField,
  onSetLinkComponentId,
  onSetLinkProjectName,
  onSetLinkWorkspaceId,
  selectedProjectGraph,
  selectedWorkspaceGraph,
  tipComponentLinks,
  tipComponentMessage,
  tipEditorMessage,
  tipEditorState,
  tipRevisions,
  tipValidationErrors,
  tips,
  workspaceToRouteParam,
}: TipStudioPanelProps) {
  return (
    <Panel
      description="Compose prevention tips, attach scanned component links, and persist immutable revisions."
      title="Tip Studio"
    >
      {!canCreateTips ? (
        <p className="text-sm text-amber-200">Permission denied. tips.create is required.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <div>
              <label className="app-label" htmlFor="tip-selector">
                Tip draft
              </label>
              <select
                className="app-select"
                id="tip-selector"
                onChange={(event) => onSelectDraftTip(event.target.value)}
                value={draftTipId ?? ''}
              >
                <option value="">Create new draft</option>
                {tips?.map((tip) => (
                  <option key={tip.id} value={tip.id}>
                    {tip.title} ({tip.status}, r{tip.currentRevision})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="app-btn-secondary"
              disabled={!canLoadSelectedTip}
              onClick={onLoadSelectedTipContent}
              type="button"
            >
              Load selected tip content
            </button>
            <button className="app-btn-secondary" onClick={onResetToNewDraft} type="button">
              New draft
            </button>
          </div>
          {draftTipId && !editorTip ? (
            <p className="text-xs text-slate-400">
              Select "Load selected tip content" to hydrate editor fields from stored draft values.
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="app-label" htmlFor="tip-symptom">
                Symptom
              </label>
              <textarea
                className="app-textarea"
                id="tip-symptom"
                onChange={(event) => onSetEditorField('symptom', event.target.value)}
                rows={3}
                value={tipEditorState.symptom}
              />
              <FieldError message={tipValidationErrors.symptom} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-root-cause">
                Root cause
              </label>
              <textarea
                className="app-textarea"
                id="tip-root-cause"
                onChange={(event) => onSetEditorField('rootCause', event.target.value)}
                rows={5}
                value={tipEditorState.rootCause}
              />
              <FieldError message={tipValidationErrors.rootCause} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-fix">
                Fix
              </label>
              <textarea
                className="app-textarea"
                id="tip-fix"
                onChange={(event) => onSetEditorField('fix', event.target.value)}
                rows={5}
                value={tipEditorState.fix}
              />
              <FieldError message={tipValidationErrors.fix} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-prevention">
                Prevention
              </label>
              <textarea
                className="app-textarea"
                id="tip-prevention"
                onChange={(event) => onSetEditorField('prevention', event.target.value)}
                rows={5}
                value={tipEditorState.prevention}
              />
              <FieldError message={tipValidationErrors.prevention} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="app-label" htmlFor="tip-project">
                Project (optional)
              </label>
              <input
                className="app-input"
                id="tip-project"
                onChange={(event) => onSetEditorField('project', event.target.value)}
                placeholder="media-press"
                value={tipEditorState.project}
              />
              <FieldError message={tipValidationErrors.project} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-library">
                Library (optional)
              </label>
              <input
                className="app-input"
                id="tip-library"
                onChange={(event) => onSetEditorField('library', event.target.value)}
                placeholder="billing-core"
                value={tipEditorState.library}
              />
              <FieldError message={tipValidationErrors.library} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-component">
                Component (optional)
              </label>
              <input
                className="app-input"
                id="tip-component"
                onChange={(event) => onSetEditorField('component', event.target.value)}
                placeholder="InvoiceSummary"
                value={tipEditorState.component}
              />
              <FieldError message={tipValidationErrors.component} />
            </div>
          </div>

          <Panel
            className="border border-white/10 bg-white/[0.02]"
            description="Attach scanned component entities for many-to-many lookup."
            title="Component links"
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <label className="app-label" htmlFor="tip-link-workspace">
                  Workspace
                </label>
                <select
                  className="app-select"
                  id="tip-link-workspace"
                  onChange={(event) => onSetLinkWorkspaceId(event.target.value)}
                  value={linkWorkspaceId}
                >
                  <option value="">Select workspace</option>
                  {componentWorkspaces?.map((workspace) => (
                    <option key={workspace.workspaceId} value={workspace.workspaceId}>
                      {workspace.workspaceId} (v{workspace.graphVersionNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="app-label" htmlFor="tip-link-project">
                  Project/Library
                </label>
                <select
                  className="app-select"
                  disabled={!linkWorkspaceId || !selectedWorkspaceGraph}
                  id="tip-link-project"
                  onChange={(event) => onSetLinkProjectName(event.target.value)}
                  value={linkProjectName}
                >
                  <option value="">Select project or library</option>
                  {selectedWorkspaceGraph?.projects.map((project) => (
                    <option key={project.name} value={project.name}>
                      {project.name} ({project.type}, {project.componentCount} components)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="app-label" htmlFor="tip-link-component">
                  Component
                </label>
                <select
                  className="app-select"
                  disabled={!linkWorkspaceId || !linkProjectName || !selectedProjectGraph}
                  id="tip-link-component"
                  onChange={(event) => onSetLinkComponentId(event.target.value)}
                  value={linkComponentId}
                >
                  <option value="">Select component</option>
                  {selectedProjectGraph?.components.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.name} ({component.filePath})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="app-btn"
                disabled={!linkWorkspaceId || !linkProjectName || !linkComponentId}
                onClick={onAddSelectedComponentLink}
                type="button"
              >
                Add component link
              </button>
              <Link className="app-btn-secondary" to="/explorer">
                Open component explorer
              </Link>
            </div>

            {linkWorkspaceId && selectedWorkspaceGraph === undefined ? (
              <p className="mt-3 text-sm text-slate-300">Loading workspace graph snapshot...</p>
            ) : null}
            {linkWorkspaceId && selectedWorkspaceGraph === null ? (
              <p className="mt-3 text-sm text-amber-200">No graph snapshot found for selected workspace.</p>
            ) : null}
            {linkWorkspaceId && linkProjectName && selectedProjectGraph === undefined ? (
              <p className="mt-3 text-sm text-slate-300">Loading components for selected project...</p>
            ) : null}
            {linkWorkspaceId && linkProjectName && selectedProjectGraph === null ? (
              <p className="mt-3 text-sm text-amber-200">Selected project was not found in latest graph.</p>
            ) : null}
            {tipComponentMessage ? <p className="mt-3 text-sm text-cyan-100">{tipComponentMessage}</p> : null}

            {tipComponentLinks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">No component links are attached to this draft yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {tipComponentLinks.map((link) => (
                  <li key={getTipComponentLinkKey(link)} className="app-card py-3">
                    <p className="text-sm text-slate-100">
                      <code className="app-code">
                        {link.workspaceId}/{link.projectName}/{link.componentName}
                      </code>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      <code className="app-code">{link.componentFilePath}</code>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        className="app-btn-secondary"
                        params={{
                          projectName: link.projectName,
                          workspaceId: workspaceToRouteParam(link.workspaceId),
                        }}
                        to="/explorer/$workspaceId/project/$projectName"
                      >
                        Open project
                      </Link>
                      <button
                        className="app-btn-danger"
                        onClick={() => onRemoveComponentLink(link)}
                        type="button"
                      >
                        Remove link
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="app-label" htmlFor="tip-tags">
                Tags (comma or newline separated)
              </label>
              <textarea
                className="app-textarea"
                id="tip-tags"
                onChange={(event) => onSetEditorField('tags', event.target.value)}
                rows={3}
                value={tipEditorState.tags}
              />
              <FieldError message={tipValidationErrors.tags} />
            </div>
            <div>
              <label className="app-label" htmlFor="tip-references">
                References (comma or newline separated)
              </label>
              <textarea
                className="app-textarea"
                id="tip-references"
                onChange={(event) => onSetEditorField('references', event.target.value)}
                rows={3}
                value={tipEditorState.references}
              />
              <FieldError message={tipValidationErrors.references} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="app-btn" onClick={onSaveDraft} type="button">
              Save draft
            </button>
            {draftTipId ? (
              <p className="flex items-center text-sm text-slate-300">
                Current draft: <code className="app-code ml-2">{draftTipId}</code>
              </p>
            ) : null}
          </div>

          {draftTipId && editorTipComponentLinks === undefined ? (
            <p className="text-sm text-slate-300">Loading existing component links for this tip...</p>
          ) : null}
          {tipEditorMessage ? <p className="text-sm text-cyan-100">{tipEditorMessage}</p> : null}

          {draftTipId ? (
            <Panel
              className="border border-white/10 bg-white/[0.02]"
              description="Stored immutable revisions for selected tip."
              title="Revision history"
            >
              {tipRevisions?.length === 0 ? <p className="text-sm text-slate-300">No revisions saved yet.</p> : null}
              {tipRevisions ? (
                <ul className="space-y-2">
                  {tipRevisions.map((revision) => (
                    <li key={revision.revisionId} className="app-card py-3">
                      <p className="text-sm text-slate-100">
                        r{revision.revisionNumber} ({revision.status}) by{' '}
                        <code className="app-code">{revision.editedByWorkosUserId}</code>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(revision.createdAt).toISOString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-300">Loading revisions...</p>
              )}
            </Panel>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
