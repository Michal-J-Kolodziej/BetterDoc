import { Link, createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import { hasPermission, type AppRole, type Permission } from '../lib/rbac'
import { encodeWorkspaceRouteParam } from '../lib/workspace-route'
import {
  buildTipDraftPayload,
  createEmptyTipEditorState,
  type TipEditorFormState,
  type TipEditorValidationErrors,
} from '../lib/tip-editor'

type TipStatus = 'draft' | 'in_review' | 'published' | 'deprecated'
type TipSearchStatus = 'all' | TipStatus

type TipSearchState = {
  searchText: string
  project: string
  library: string
  component: string
  tag: string
  status: TipSearchStatus
}

type TipComponentLink = {
  workspaceId: string
  projectName: string
  componentName: string
  componentFilePath: string
}

function getTipComponentLinkKey(link: TipComponentLink): string {
  return [
    link.workspaceId.toLowerCase(),
    link.projectName.toLowerCase(),
    link.componentName.toLowerCase(),
    link.componentFilePath.toLowerCase(),
  ].join('::')
}

const searchFieldLimits = {
  project: 96,
  library: 96,
  component: 96,
  tag: 48,
} as const

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  server: {
    handlers: {
      GET: async ({ context, next, request }) => {
        const auth = context.auth()

        if (!auth.user) {
          const authkit = await getAuthkit()
          const signInUrl = await authkit.getSignInUrl({
            returnPathname: new URL(request.url).pathname,
            redirectUri: context.redirectUri,
          })

          return Response.redirect(signInUrl, 307)
        }

        return next()
      },
    },
  },
  component: DashboardPage,
})

function createEmptyTipSearchState(): TipSearchState {
  return {
    searchText: '',
    project: '',
    library: '',
    component: '',
    tag: '',
    status: 'all',
  }
}

function validateTipSearchState(state: TipSearchState): string | null {
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

function DashboardPage() {
  const auth = useAuth()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [tipEditorMessage, setTipEditorMessage] = useState<string | null>(null)
  const [draftTipId, setDraftTipId] = useState<Id<'tips'> | null>(null)
  const [tipEditorState, setTipEditorState] = useState<TipEditorFormState>(
    createEmptyTipEditorState,
  )
  const [tipValidationErrors, setTipValidationErrors] =
    useState<TipEditorValidationErrors>({})
  const [tipSearchState, setTipSearchState] = useState<TipSearchState>(
    createEmptyTipSearchState,
  )
  const [targetWorkosUserId, setTargetWorkosUserId] = useState('')
  const [nextRole, setNextRole] = useState<AppRole>('Reader')
  const [tipComponentLinks, setTipComponentLinks] = useState<TipComponentLink[]>([])
  const [tipComponentMessage, setTipComponentMessage] = useState<string | null>(null)
  const [linkWorkspaceId, setLinkWorkspaceId] = useState('')
  const [linkProjectName, setLinkProjectName] = useState('')
  const [linkComponentId, setLinkComponentId] = useState('')
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [showUnreadNotificationsOnly, setShowUnreadNotificationsOnly] =
    useState(false)

  const bootstrapFirstAdmin = useMutation(api.accessControl.bootstrapFirstAdmin)
  const assignRole = useMutation(api.accessControl.assignRole)
  const saveTipDraft = useMutation(api.accessControl.saveTipDraft)
  const submitTipForReview = useMutation(api.accessControl.submitTipForReview)
  const returnTipToDraft = useMutation(api.accessControl.returnTipToDraft)
  const publishTip = useMutation(api.accessControl.publishTip)
  const deprecateTip = useMutation(api.accessControl.deprecateTip)
  const configureIntegration = useMutation(api.accessControl.configureIntegration)
  const unsubscribeFromComponentWatchlist = useMutation(
    api.accessControl.unsubscribeFromComponentWatchlist,
  )
  const markWatchNotificationRead = useMutation(
    api.accessControl.markWatchNotificationRead,
  )
  const markAllWatchNotificationsRead = useMutation(
    api.accessControl.markAllWatchNotificationsRead,
  )

  const user = auth.user
  const organizationId = auth.organizationId ?? undefined

  const accessProfile = useQuery(
    api.accessControl.getAccessProfile,
    user
      ? {
          workosUserId: user.id,
          organizationId,
        }
      : 'skip',
  )

  const role = accessProfile?.role ?? 'Reader'
  const canCreateTips = accessProfile
    ? hasPermission(accessProfile.role, 'tips.create')
    : false
  const canReadTips = accessProfile
    ? hasPermission(accessProfile.role, 'tips.read')
    : false
  const canReadAudit = accessProfile
    ? hasPermission(accessProfile.role, 'audit.read')
    : false

  const auditEvents = useQuery(
    api.accessControl.listAuditEvents,
    user && canReadAudit
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 12,
        }
      : 'skip',
  )

  const tips = useQuery(
    api.accessControl.listTips,
    user && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 120,
        }
      : 'skip',
  )

  const tipSearchError = validateTipSearchState(tipSearchState)

  const filteredTips = useQuery(
    api.accessControl.listTips,
    user && canReadTips && !tipSearchError
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          searchText: tipSearchState.searchText,
          project: tipSearchState.project,
          library: tipSearchState.library,
          component: tipSearchState.component,
          tag: tipSearchState.tag,
          status:
            tipSearchState.status === 'all'
              ? undefined
              : tipSearchState.status,
          limit: 60,
        }
      : 'skip',
  )

  const editorTip = useQuery(
    api.accessControl.getTipForEditor,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
        }
      : 'skip',
  )

  const tipRevisions = useQuery(
    api.accessControl.listTipRevisions,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
          limit: 10,
        }
      : 'skip',
  )

  const editorTipComponentLinks = useQuery(
    api.accessControl.listTipComponentLinksForEditor,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
        }
      : 'skip',
  )

  const componentWorkspaces = useQuery(
    api.accessControl.listComponentExplorerWorkspaces,
    user && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 20,
        }
      : 'skip',
  )

  const selectedWorkspaceGraph = useQuery(
    api.accessControl.getComponentExplorerWorkspace,
    user && canCreateTips && linkWorkspaceId
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId: linkWorkspaceId,
        }
      : 'skip',
  )

  const selectedProjectGraph = useQuery(
    api.accessControl.getComponentExplorerProject,
    user && canCreateTips && linkWorkspaceId && linkProjectName
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId: linkWorkspaceId,
          projectName: linkProjectName,
        }
      : 'skip',
  )

  const myWatchSubscriptions = useQuery(
    api.accessControl.listMyComponentWatchSubscriptions,
    user && canReadTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 60,
        }
      : 'skip',
  )

  const watchNotifications = useQuery(
    api.accessControl.listWatchNotifications,
    user && canReadTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          unreadOnly: showUnreadNotificationsOnly,
          limit: 60,
        }
      : 'skip',
  )

  const selectedTipStatus =
    editorTip?.status ?? tips?.find((tip) => tip.id === draftTipId)?.status ?? null

  const can = (permission: Permission) =>
    accessProfile ? hasPermission(role, permission) : false

  const runAction = async (
    successMessage: string,
    action: () => Promise<void>,
  ) => {
    try {
      await action()
      setStatusMessage(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setStatusMessage(`Action failed: ${message}`)
    }
  }

  const addSelectedComponentLink = () => {
    if (!selectedProjectGraph || !linkComponentId) {
      setTipComponentMessage(
        'Select a workspace, project, and component before adding a link.',
      )
      return
    }

    const component = selectedProjectGraph.components.find(
      (entry) => entry.id === linkComponentId,
    )

    if (!component) {
      setTipComponentMessage('Selected component was not found in this project.')
      return
    }

    const nextLink: TipComponentLink = {
      workspaceId: linkWorkspaceId,
      projectName: selectedProjectGraph.project.name,
      componentName: component.name,
      componentFilePath: component.filePath,
    }

    const nextKey = getTipComponentLinkKey(nextLink)
    const hasDuplicate = tipComponentLinks.some(
      (link) => getTipComponentLinkKey(link) === nextKey,
    )

    if (hasDuplicate) {
      setTipComponentMessage('This component is already linked to the draft.')
      return
    }

    setTipComponentLinks((current) => [...current, nextLink])
    setTipComponentMessage('Component link added.')
  }

  const removeComponentLink = (linkToRemove: TipComponentLink) => {
    const removeKey = getTipComponentLinkKey(linkToRemove)
    setTipComponentLinks((current) =>
      current.filter((link) => getTipComponentLinkKey(link) !== removeKey),
    )
    setTipComponentMessage('Component link removed.')
  }

  const removeWatchSubscription = async (link: TipComponentLink) => {
    if (!user) {
      return
    }

    try {
      const result = await unsubscribeFromComponentWatchlist({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        workspaceId: link.workspaceId,
        projectName: link.projectName,
        componentName: link.componentName,
        componentFilePath: link.componentFilePath,
      })

      if (result.removedCount === 0) {
        setWatchlistMessage('No matching watchlist subscription was found.')
        return
      }

      setWatchlistMessage(
        `Watchlist subscription removed (${String(result.removedCount)} record${result.removedCount === 1 ? '' : 's'}).`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setWatchlistMessage(`Failed to remove watchlist subscription: ${message}`)
    }
  }

  const markNotificationAsRead = async (notificationId: Id<'watchNotifications'>) => {
    if (!user) {
      return
    }

    try {
      const result = await markWatchNotificationRead({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        notificationId,
      })

      setNotificationMessage(
        result.updated
          ? 'Notification marked as read.'
          : 'Notification was already marked as read.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setNotificationMessage(`Failed to mark notification as read: ${message}`)
    }
  }

  const markAllNotificationsAsRead = async () => {
    if (!user) {
      return
    }

    try {
      const result = await markAllWatchNotificationsRead({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        limit: 120,
      })

      setNotificationMessage(
        `Marked ${String(result.updatedCount)} notification${result.updatedCount === 1 ? '' : 's'} as read.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setNotificationMessage(`Failed to mark notifications: ${message}`)
    }
  }

  const setEditorField = (
    field: keyof TipEditorFormState,
    value: string,
  ) => {
    setTipEditorState((current) => ({
      ...current,
      [field]: value,
    }))

    setTipValidationErrors((current) => {
      if (!current[field]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const setTipSearchField = <K extends keyof TipSearchState>(
    field: K,
    value: TipSearchState[K],
  ) => {
    setTipSearchState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const resetEditorToNewDraft = () => {
    setDraftTipId(null)
    setTipEditorState(createEmptyTipEditorState())
    setTipValidationErrors({})
    setTipEditorMessage(null)
    setTipComponentLinks([])
    setTipComponentMessage(null)
    setLinkWorkspaceId('')
    setLinkProjectName('')
    setLinkComponentId('')
  }

  const saveEditorDraft = async () => {
    if (!user) {
      return
    }

    const { payload, errors } = buildTipDraftPayload(tipEditorState)
    if (!payload) {
      setTipValidationErrors(errors)
      setTipEditorMessage('Fix validation errors before saving.')
      return
    }

    try {
      const result = await saveTipDraft({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        tipId: draftTipId ?? undefined,
        ...payload,
        componentLinks: tipComponentLinks,
      })

      setDraftTipId(result.tipId)
      setTipValidationErrors({})
      setTipEditorMessage(
        `Draft saved as revision ${result.revisionNumber} at ${new Date(result.updatedAt).toLocaleString()} with ${String(tipComponentLinks.length)} linked component${tipComponentLinks.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTipEditorMessage(`Draft save failed: ${message}`)
    }
  }

  if (auth.loading || !user || !accessProfile) {
    return (
      <main className="bd-loading-view">
        <h1>Authenticated Dashboard</h1>
        <p>Loading role-aware access profile...</p>
      </main>
    )
  }

  return (
    <div className="bd-dashboard-shell">
      <aside className="bd-dashboard-sidebar">
        <div className="bd-sidebar-brand">
          <strong>BetterDoc</strong>
          <span>Governance + prevention tips</span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Dashboard sections">
          <a href="#session-role">Session + Role</a>
          <a href="#tip-editor">Tip Editor</a>
          <a href="#tip-workflow">Workflow</a>
          <a href="#tips-search">Tip Search</a>
          <a href="#watch-notifications">Notifications</a>
          <a href="#audit-events">Audit Events</a>
        </nav>
        <div className="bd-sidebar-meta">
          <p>
            Signed in as <code>{role}</code>
          </p>
          <p>
            <Link to="/logout">Sign out</Link>
          </p>
        </div>
      </aside>

      <div className="bd-dashboard-stage">
        <header className="bd-dashboard-topbar">
          <div>
            <h1>Engineering Insights Dashboard</h1>
            <p>
              Access is protected by WorkOS session checks plus capability guards
              mapped from the signed-in user role.
            </p>
          </div>
          <div className="bd-dashboard-topbar-actions">
            <Link to="/explorer">Component explorer</Link>
            <Link to="/">Home</Link>
          </div>
        </header>

        <main className="bd-dashboard-main">
      <section id="session-role" className="bd-panel">
        <h2>Session + Role</h2>
        <p>
          WorkOS user: <code>{user.id}</code>
        </p>
        <p>
          Active role: <code>{role}</code>
        </p>
        <p>
          Organization: <code>{organizationId ?? 'none'}</code>
        </p>
      </section>

      <section id="rbac-matrix" className="bd-panel">
        <h2>RBAC Matrix</h2>
        <p>
          Reader: <code>tips.read</code>
        </p>
        <p>
          Contributor: <code>tips.read</code>, <code>tips.create</code>
        </p>
        <p>
          Reviewer: Contributor + <code>tips.publish</code>,{' '}
          <code>tips.deprecate</code>, <code>audit.read</code>
        </p>
        <p>
          Admin: Reviewer + <code>roles.assign</code>,{' '}
          <code>integration.configure</code>
        </p>
      </section>

      <section id="tip-editor" className="bd-panel">
        <h2>Tip Editor (BD-006, BD-007)</h2>
        {!canCreateTips && (
          <p>
            Permission denied. <code>tips.create</code> is required.
          </p>
        )}

        {canCreateTips && (
          <>
            <p>
              Structured fields are stored as tip revisions. Root cause, fix, and
              prevention support markdown text.
            </p>

            <p>
              <label htmlFor="tip-selector">Edit existing tip: </label>
              <select
                id="tip-selector"
                value={draftTipId ?? ''}
                onChange={(event) => {
                  const nextTipId = event.target.value
                  setTipEditorMessage(null)
                  setTipComponentMessage(null)

                  if (!nextTipId) {
                    resetEditorToNewDraft()
                    return
                  }

                  setDraftTipId(nextTipId as Id<'tips'>)
                  setTipValidationErrors({})
                  setTipComponentLinks([])
                }}
              >
                <option value="">Create new draft</option>
                {tips?.map((tip) => (
                  <option key={tip.id} value={tip.id}>
                    {tip.title} ({tip.status}, r{tip.currentRevision})
                  </option>
                ))}
              </select>
            </p>

            {draftTipId && editorTip && (
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setTipEditorState({
                      symptom: editorTip.symptom,
                      rootCause: editorTip.rootCause,
                      fix: editorTip.fix,
                      prevention: editorTip.prevention,
                      project: editorTip.project ?? '',
                      library: editorTip.library ?? '',
                      component: editorTip.component ?? '',
                      tags: editorTip.tags.join(', '),
                      references: editorTip.references.join('\n'),
                    })
                    if (editorTipComponentLinks) {
                      setTipComponentLinks(
                        editorTipComponentLinks.map((link) => ({
                          workspaceId: link.workspaceId,
                          projectName: link.projectName,
                          componentName: link.componentName,
                          componentFilePath: link.componentFilePath,
                        })),
                      )
                      setTipComponentMessage(
                        `Loaded ${String(editorTipComponentLinks.length)} linked component${editorTipComponentLinks.length === 1 ? '' : 's'}.`,
                      )
                    } else {
                      setTipComponentMessage(
                        'Tip content loaded. Component links are still loading.',
                      )
                    }
                    setTipValidationErrors({})
                    setTipEditorMessage('Loaded selected tip content into the editor.')
                  }}
                >
                  Load selected tip content
                </button>
              </p>
            )}

            <p>
              <label htmlFor="tip-symptom">Symptom</label>
              <br />
              <textarea
                id="tip-symptom"
                rows={3}
                value={tipEditorState.symptom}
                onChange={(event) =>
                  setEditorField('symptom', event.target.value)
                }
              />
              {tipValidationErrors.symptom && <br />}
              {tipValidationErrors.symptom && (
                <small>{tipValidationErrors.symptom}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-root-cause">Root cause</label>
              <br />
              <textarea
                id="tip-root-cause"
                rows={5}
                value={tipEditorState.rootCause}
                onChange={(event) =>
                  setEditorField('rootCause', event.target.value)
                }
              />
              {tipValidationErrors.rootCause && <br />}
              {tipValidationErrors.rootCause && (
                <small>{tipValidationErrors.rootCause}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-fix">Fix</label>
              <br />
              <textarea
                id="tip-fix"
                rows={5}
                value={tipEditorState.fix}
                onChange={(event) => setEditorField('fix', event.target.value)}
              />
              {tipValidationErrors.fix && <br />}
              {tipValidationErrors.fix && <small>{tipValidationErrors.fix}</small>}
            </p>

            <p>
              <label htmlFor="tip-prevention">Prevention</label>
              <br />
              <textarea
                id="tip-prevention"
                rows={5}
                value={tipEditorState.prevention}
                onChange={(event) =>
                  setEditorField('prevention', event.target.value)
                }
              />
              {tipValidationErrors.prevention && <br />}
              {tipValidationErrors.prevention && (
                <small>{tipValidationErrors.prevention}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-project">Project (optional)</label>
              <br />
              <input
                id="tip-project"
                value={tipEditorState.project}
                onChange={(event) => setEditorField('project', event.target.value)}
                placeholder="media-press"
              />
              {tipValidationErrors.project && <br />}
              {tipValidationErrors.project && (
                <small>{tipValidationErrors.project}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-library">Library (optional)</label>
              <br />
              <input
                id="tip-library"
                value={tipEditorState.library}
                onChange={(event) => setEditorField('library', event.target.value)}
                placeholder="billing-core"
              />
              {tipValidationErrors.library && <br />}
              {tipValidationErrors.library && (
                <small>{tipValidationErrors.library}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-component">Component (optional)</label>
              <br />
              <input
                id="tip-component"
                value={tipEditorState.component}
                onChange={(event) => setEditorField('component', event.target.value)}
                placeholder="InvoiceSummary"
              />
              {tipValidationErrors.component && <br />}
              {tipValidationErrors.component && (
                <small>{tipValidationErrors.component}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-link-workspace">Component links (BD-013)</label>
              <br />
              <small>
                Link this tip to scanned components for many-to-many lookup from
                component detail pages.
              </small>
              {componentWorkspaces === undefined && (
                <>
                  <br />
                  <small>Loading scanned workspaces...</small>
                </>
              )}
              {componentWorkspaces?.length === 0 && (
                <>
                  <br />
                  <small>No scanned workspaces found yet.</small>
                </>
              )}
              <br />
              <select
                id="tip-link-workspace"
                value={linkWorkspaceId}
                onChange={(event) => {
                  setLinkWorkspaceId(event.target.value)
                  setLinkProjectName('')
                  setLinkComponentId('')
                  setTipComponentMessage(null)
                }}
              >
                <option value="">Select workspace</option>
                {componentWorkspaces?.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.workspaceId} (v{workspace.graphVersionNumber})
                  </option>
                ))}
              </select>
            </p>

            {linkWorkspaceId && selectedWorkspaceGraph === undefined && (
              <p>Loading workspace graph snapshot...</p>
            )}
            {linkWorkspaceId && selectedWorkspaceGraph === null && (
              <p>
                No graph snapshot found for workspace <code>{linkWorkspaceId}</code>.
              </p>
            )}

            <p>
              <label htmlFor="tip-link-project">Project/Library</label>
              <br />
              <select
                id="tip-link-project"
                value={linkProjectName}
                disabled={!linkWorkspaceId || !selectedWorkspaceGraph}
                onChange={(event) => {
                  setLinkProjectName(event.target.value)
                  setLinkComponentId('')
                  setTipComponentMessage(null)
                }}
              >
                <option value="">Select project or library</option>
                {selectedWorkspaceGraph?.projects.map((project) => (
                  <option key={project.name} value={project.name}>
                    {project.name} ({project.type}, {project.componentCount} components)
                  </option>
                ))}
              </select>
            </p>

            {linkWorkspaceId && linkProjectName && selectedProjectGraph === undefined && (
              <p>Loading components for selected project...</p>
            )}
            {linkWorkspaceId && linkProjectName && selectedProjectGraph === null && (
              <p>
                Selected project <code>{linkProjectName}</code> was not found in the
                latest workspace graph.
              </p>
            )}

            <p>
              <label htmlFor="tip-link-component">Component</label>
              <br />
              <select
                id="tip-link-component"
                value={linkComponentId}
                disabled={!linkWorkspaceId || !linkProjectName || !selectedProjectGraph}
                onChange={(event) => {
                  setLinkComponentId(event.target.value)
                  setTipComponentMessage(null)
                }}
              >
                <option value="">Select component</option>
                {selectedProjectGraph?.components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name} ({component.filePath})
                  </option>
                ))}
              </select>
            </p>

            <p>
              <button
                type="button"
                onClick={addSelectedComponentLink}
                disabled={!linkWorkspaceId || !linkProjectName || !linkComponentId}
              >
                Add component link
              </button>{' '}
              <Link to="/explorer">Open component explorer</Link>
            </p>

            {tipComponentMessage && <p>{tipComponentMessage}</p>}
            {tipComponentLinks.length === 0 && (
              <p>No component links are attached to this draft yet.</p>
            )}
            {tipComponentLinks.map((link) => (
              <p key={getTipComponentLinkKey(link)}>
                <code>
                  {link.workspaceId}/{link.projectName}/{link.componentName}
                </code>
                <br />
                <code>{link.componentFilePath}</code>
                <br />
                <Link
                  to="/explorer/$workspaceId/project/$projectName"
                  params={{
                    workspaceId: encodeWorkspaceRouteParam(link.workspaceId),
                    projectName: link.projectName,
                  }}
                >
                  Open project
                </Link>{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => removeComponentLink(link)}
                >
                  Remove link
                </button>
              </p>
            ))}

            <p>
              <label htmlFor="tip-tags">Tags (comma or newline separated)</label>
              <br />
              <textarea
                id="tip-tags"
                rows={3}
                value={tipEditorState.tags}
                onChange={(event) => setEditorField('tags', event.target.value)}
              />
              {tipValidationErrors.tags && <br />}
              {tipValidationErrors.tags && <small>{tipValidationErrors.tags}</small>}
            </p>

            <p>
              <label htmlFor="tip-references">
                References (comma or newline separated)
              </label>
              <br />
              <textarea
                id="tip-references"
                rows={4}
                value={tipEditorState.references}
                onChange={(event) =>
                  setEditorField('references', event.target.value)
                }
              />
              {tipValidationErrors.references && <br />}
              {tipValidationErrors.references && (
                <small>{tipValidationErrors.references}</small>
              )}
            </p>

            <p>
              <button type="button" onClick={saveEditorDraft}>
                Save draft
              </button>{' '}
              <button type="button" onClick={resetEditorToNewDraft}>
                New draft
              </button>
            </p>

            {draftTipId && (
              <p>
                Current draft tip ID: <code>{draftTipId}</code>
              </p>
            )}
            {draftTipId && editorTipComponentLinks === undefined && (
              <p>Loading existing component links for this tip...</p>
            )}
            {tipEditorMessage && <p>{tipEditorMessage}</p>}

            {draftTipId && (
              <>
                <h3>Revision history</h3>
                {tipRevisions?.length === 0 && <p>No revisions saved yet.</p>}
                {tipRevisions?.map((revision) => (
                  <p key={revision.revisionId}>
                    r{revision.revisionNumber} ({revision.status}) by{' '}
                    <code>{revision.editedByWorkosUserId}</code> at{' '}
                    {new Date(revision.createdAt).toISOString()}
                  </p>
                ))}
              </>
            )}
          </>
        )}
      </section>

      <section id="tip-workflow" className="bd-panel">
        <h2>Tip Workflow (BD-008)</h2>
        {!canCreateTips && (
          <p>
            Permission denied. <code>tips.create</code> is required.
          </p>
        )}

        {canCreateTips && (
          <>
            {!draftTipId && <p>Select a tip in the editor to run transitions.</p>}
            {draftTipId && (
              <p>
                Selected tip status: <code>{selectedTipStatus ?? 'loading'}</code>
              </p>
            )}

            <p>
              <button
                type="button"
                disabled={!draftTipId || selectedTipStatus !== 'draft'}
                onClick={() =>
                  runAction('Tip moved to in_review.', async () => {
                    if (!draftTipId) {
                      throw new Error('Save a draft tip first.')
                    }

                    await submitTipForReview({
                      actorWorkosUserId: user.id,
                      actorOrganizationId: organizationId,
                      tipId: draftTipId,
                    })
                  })
                }
              >
                Submit for review (Contributor+)
              </button>
            </p>

            <p>
              <button
                type="button"
                disabled={!can('tips.publish') || !draftTipId || selectedTipStatus !== 'in_review'}
                onClick={() =>
                  runAction('Tip returned to draft for edits.', async () => {
                    if (!draftTipId) {
                      throw new Error('Select a tip first.')
                    }

                    await returnTipToDraft({
                      actorWorkosUserId: user.id,
                      actorOrganizationId: organizationId,
                      tipId: draftTipId,
                    })
                  })
                }
              >
                Return to draft (Reviewer+)
              </button>
            </p>

            <p>
              <button
                type="button"
                disabled={!can('tips.publish') || !draftTipId || selectedTipStatus !== 'in_review'}
                onClick={async () => {
                  if (!draftTipId) {
                    setStatusMessage('Action failed: Select a tip first.')
                    return
                  }

                  try {
                    const result = await publishTip({
                      actorWorkosUserId: user.id,
                      actorOrganizationId: organizationId,
                      tipId: draftTipId,
                    })

                    setStatusMessage(
                      `Tip published and audited. ${String(result.notificationCount)} ${result.notificationEventType} notification${result.notificationCount === 1 ? '' : 's'} logged.`,
                    )
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : 'Unknown error'
                    setStatusMessage(`Action failed: ${message}`)
                  }
                }}
              >
                Publish tip (Reviewer+)
              </button>
            </p>

            <p>
              <button
                type="button"
                disabled={!can('tips.deprecate') || !draftTipId || selectedTipStatus !== 'published'}
                onClick={() =>
                  runAction('Tip deprecated and audit event stored.', async () => {
                    if (!draftTipId) {
                      throw new Error('Select a tip first.')
                    }

                    await deprecateTip({
                      actorWorkosUserId: user.id,
                      actorOrganizationId: organizationId,
                      tipId: draftTipId,
                    })
                  })
                }
              >
                Deprecate tip (Reviewer+)
              </button>
            </p>
          </>
        )}
      </section>

      <section id="privileged-actions" className="bd-panel">
        <h2>Privileged Actions (Guarded)</h2>
        <p>
          <button
            type="button"
            onClick={() =>
              runAction('Bootstrap completed: current user is now Admin.', async () => {
                await bootstrapFirstAdmin({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                })
              })
            }
          >
            Bootstrap first admin (one-time)
          </button>
        </p>

        <p>
          <label htmlFor="target-user-id">Role assignment target user ID: </label>
          <input
            id="target-user-id"
            value={targetWorkosUserId}
            onChange={(event) => setTargetWorkosUserId(event.target.value)}
            placeholder="user_123"
          />
        </p>
        <p>
          <label htmlFor="next-role">Next role: </label>
          <select
            id="next-role"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value as AppRole)}
          >
            <option value="Reader">Reader</option>
            <option value="Contributor">Contributor</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Admin">Admin</option>
          </select>
        </p>
        <p>
          <button
            type="button"
            disabled={!can('roles.assign') || targetWorkosUserId.length === 0}
            onClick={() =>
              runAction('Role assignment saved and audited.', async () => {
                await assignRole({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                  targetWorkosUserId,
                  role: nextRole,
                })
              })
            }
          >
            Assign role (Admin)
          </button>
        </p>

        <p>
          <button
            type="button"
            disabled={!can('integration.configure')}
            onClick={() =>
              runAction(
                'Integration config updated and audit event stored.',
                async () => {
                  await configureIntegration({
                    actorWorkosUserId: user.id,
                    actorOrganizationId: organizationId,
                    key: 'azure-devops',
                    enabled: true,
                  })
                },
              )
            }
          >
            Configure integration (Admin)
          </button>
        </p>

        {statusMessage && <p>{statusMessage}</p>}
      </section>

      <section id="tips-search" className="bd-panel">
        <h2>Tips Search (BD-009)</h2>
        {!canReadTips && (
          <p>
            Permission denied. <code>tips.read</code> is required.
          </p>
        )}

        {canReadTips && (
          <>
            <p>
              Filterable tip discovery with indexed querying across text,
              project, library, component, tag, and status.
            </p>

            <p>
              <label htmlFor="tip-search-text">Text search</label>
              <br />
              <input
                id="tip-search-text"
                value={tipSearchState.searchText}
                onChange={(event) =>
                  setTipSearchField('searchText', event.target.value)
                }
                placeholder="race condition callback"
              />
            </p>

            <p>
              <label htmlFor="tip-search-project">Project</label>
              <br />
              <input
                id="tip-search-project"
                value={tipSearchState.project}
                onChange={(event) =>
                  setTipSearchField('project', event.target.value)
                }
                placeholder="media-press"
              />
            </p>

            <p>
              <label htmlFor="tip-search-library">Library</label>
              <br />
              <input
                id="tip-search-library"
                value={tipSearchState.library}
                onChange={(event) =>
                  setTipSearchField('library', event.target.value)
                }
                placeholder="billing-core"
              />
            </p>

            <p>
              <label htmlFor="tip-search-component">Component</label>
              <br />
              <input
                id="tip-search-component"
                value={tipSearchState.component}
                onChange={(event) =>
                  setTipSearchField('component', event.target.value)
                }
                placeholder="InvoiceSummary"
              />
            </p>

            <p>
              <label htmlFor="tip-search-tag">Tag</label>
              <br />
              <input
                id="tip-search-tag"
                value={tipSearchState.tag}
                onChange={(event) => setTipSearchField('tag', event.target.value)}
                placeholder="react"
              />
            </p>

            <p>
              <label htmlFor="tip-search-status">Status</label>
              <br />
              <select
                id="tip-search-status"
                value={tipSearchState.status}
                onChange={(event) =>
                  setTipSearchField(
                    'status',
                    event.target.value as TipSearchStatus,
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </p>

            <p>
              <button
                type="button"
                onClick={() => setTipSearchState(createEmptyTipSearchState())}
              >
                Clear filters
              </button>
            </p>

            {tipSearchError && <p>Search error: {tipSearchError}</p>}
            {!tipSearchError && filteredTips === undefined && (
              <p>Loading indexed results...</p>
            )}
            {!tipSearchError && filteredTips?.length === 0 && (
              <p>No tips match the current filters.</p>
            )}
            {!tipSearchError &&
              filteredTips?.map((tip) => (
                <p key={tip.id}>
                  <code>{tip.slug}</code> - {tip.title} ({tip.status}, r
                  {tip.currentRevision})
                  {tip.project ? ` · project:${tip.project}` : ''}
                  {tip.library ? ` · library:${tip.library}` : ''}
                  {tip.component ? ` · component:${tip.component}` : ''}
                  {tip.tags.length > 0 ? ` · tags:${tip.tags.join(', ')}` : ''}
                </p>
              ))}
          </>
        )}
      </section>

      <section id="my-watchlist" className="bd-panel">
        <h2>My Watchlist (BD-016)</h2>
        {!canReadTips && (
          <p>
            Permission denied. <code>tips.read</code> is required.
          </p>
        )}
        {canReadTips && myWatchSubscriptions === undefined && (
          <p>Loading watchlist subscriptions...</p>
        )}
        {canReadTips && myWatchSubscriptions?.length === 0 && (
          <p>
            You are not watching any components yet. Open a component page in the
            explorer to subscribe.
          </p>
        )}
        {canReadTips &&
          myWatchSubscriptions?.map((subscription) => (
            <p key={subscription.subscriptionId}>
              <code>
                {subscription.workspaceId}/{subscription.projectName}/
                {subscription.componentName}
              </code>
              <br />
              <code>{subscription.componentFilePath}</code>
              <br />
              Updated {new Date(subscription.updatedAt).toLocaleString()}
              <br />
              <Link
                to="/explorer/$workspaceId/project/$projectName"
                params={{
                  workspaceId: encodeWorkspaceRouteParam(subscription.workspaceId),
                  projectName: subscription.projectName,
                }}
              >
                Open project
              </Link>{' '}
              ·{' '}
              <button
                type="button"
                onClick={() =>
                  void removeWatchSubscription({
                    workspaceId: subscription.workspaceId,
                    projectName: subscription.projectName,
                    componentName: subscription.componentName,
                    componentFilePath: subscription.componentFilePath,
                  })
                }
              >
                Remove
              </button>
            </p>
          ))}
        {watchlistMessage && <p>{watchlistMessage}</p>}
      </section>

      <section id="watch-notifications" className="bd-panel">
        <h2>Watch Notifications (BD-016)</h2>
        {!canReadTips && (
          <p>
            Permission denied. <code>tips.read</code> is required.
          </p>
        )}
        {canReadTips && (
          <>
            <p>
              Notifications are logged when component-linked tips are published or
              updated.
            </p>
            <p>
              <label htmlFor="notification-unread-toggle">
                <input
                  id="notification-unread-toggle"
                  type="checkbox"
                  checked={showUnreadNotificationsOnly}
                  onChange={(event) =>
                    setShowUnreadNotificationsOnly(event.target.checked)
                  }
                />{' '}
                Show unread only
              </label>
            </p>
            <p>
              <button type="button" onClick={() => void markAllNotificationsAsRead()}>
                Mark all as read
              </button>
            </p>
            {watchNotifications === undefined && <p>Loading notifications...</p>}
            {watchNotifications?.length === 0 && (
              <p>No notifications match the current filter.</p>
            )}
            {watchNotifications?.map((notification) => (
              <p key={notification.notificationId}>
                [{new Date(notification.createdAt).toLocaleString()}]{' '}
                <code>{notification.eventType}</code> · {notification.tipTitle} (
                <code>{notification.tipSlug}</code>) · r{notification.revisionNumber}
                <br />
                Component{' '}
                <code>
                  {notification.workspaceId}/{notification.projectName}/
                  {notification.componentName}
                </code>
                <br />
                Status:{' '}
                <code>
                  {notification.deliveryStatus}
                  {notification.isRead ? ', read' : ', unread'}
                </code>
                {!notification.isRead && (
                  <>
                    {' '}
                    ·{' '}
                    <button
                      type="button"
                      onClick={() =>
                        void markNotificationAsRead(notification.notificationId)
                      }
                    >
                      Mark read
                    </button>
                  </>
                )}
              </p>
            ))}
            {notificationMessage && <p>{notificationMessage}</p>}
          </>
        )}
      </section>

      <section id="audit-events" className="bd-panel">
        <h2>Audit Events</h2>
        {!canReadAudit && (
          <p>
            Permission denied. <code>audit.read</code> is required.
          </p>
        )}
        {canReadAudit && auditEvents?.length === 0 && (
          <p>No audit events yet for this tenant.</p>
        )}
        {canReadAudit &&
          auditEvents?.map((event) => (
            <p key={event.id}>
              [{new Date(event.createdAt).toISOString()}] {event.action} by{' '}
              <code>{event.actorWorkosUserId}</code> on{' '}
              <code>
                {event.targetType}:{event.targetId}
              </code>
            </p>
          ))}
      </section>

      <section id="navigation" className="bd-panel">
        <h2>Navigation</h2>
        <p>
          <Link to="/explorer">Component explorer</Link>
        </p>
        <p>
          <Link to="/logout">Sign out</Link>
        </p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>
        </main>
      </div>
    </div>
  )
}
