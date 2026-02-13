import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import {
  decodeWorkspaceRouteParam,
  encodeWorkspaceRouteParam,
} from '../lib/workspace-route'

export const Route = createFileRoute('/explorer/$workspaceId/component/$componentId')({
  ssr: false,
  component: ComponentExplorerComponentPage,
})

function ComponentExplorerComponentPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const [watchActionMessage, setWatchActionMessage] = useState<string | null>(null)
  const { workspaceId: workspaceIdParam, componentId } = Route.useParams()
  const workspaceId = decodeWorkspaceRouteParam(workspaceIdParam)
  const workspaceRouteParam = encodeWorkspaceRouteParam(workspaceId)
  const subscribeToComponentWatchlist = useMutation(
    api.accessControl.subscribeToComponentWatchlist,
  )
  const unsubscribeFromComponentWatchlist = useMutation(
    api.accessControl.unsubscribeFromComponentWatchlist,
  )
  const component = useQuery(
    api.accessControl.getComponentExplorerComponent,
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
          componentId: componentId as Id<'componentGraphComponents'>,
        }
      : 'skip',
  )
  const watchStatus = useQuery(
    api.accessControl.getComponentWatchStatus,
    user && component
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
          projectName: component.component.project,
          componentName: component.component.name,
          componentFilePath: component.component.filePath,
        }
      : 'skip',
  )

  const updateWatchStatus = async (nextState: 'watch' | 'unwatch') => {
    if (!user || !component) {
      return
    }

    try {
      if (nextState === 'watch') {
        await subscribeToComponentWatchlist({
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
          projectName: component.component.project,
          componentName: component.component.name,
          componentFilePath: component.component.filePath,
        })

        setWatchActionMessage('Watchlist subscription saved.')
        return
      }

      await unsubscribeFromComponentWatchlist({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        workspaceId,
        projectName: component.component.project,
        componentName: component.component.name,
        componentFilePath: component.component.filePath,
      })

      setWatchActionMessage('Watchlist subscription removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setWatchActionMessage(`Watchlist action failed: ${message}`)
    }
  }

  return (
    <div className="bd-explorer-shell">
      <aside className="bd-explorer-sidebar">
        <div className="bd-sidebar-brand">
          <strong>Component Detail</strong>
          <span>
            <code>{componentId}</code>
          </span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Component navigation">
          {component && (
            <Link
              to="/explorer/$workspaceId/project/$projectName"
              params={{
                workspaceId: workspaceRouteParam,
                projectName: component.component.project,
              }}
            >
              Back to project
            </Link>
          )}
          <Link to="/explorer/$workspaceId" params={{ workspaceId: workspaceRouteParam }}>
            Back to workspace
          </Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </aside>

      <main className="bd-explorer-main">
        <header className="bd-page-header">
          <div>
            <h1>Component Detail</h1>
            <p>
              Workspace <code>{workspaceId}</code> · Component ID{' '}
              <code>{componentId}</code>
            </p>
          </div>
        </header>

        {!user && (
          <section className="bd-panel">
            <h2>Sign In Required</h2>
            <p>
              <Link to="/login">Sign in with WorkOS</Link> to open component
              detail data.
            </p>
          </section>
        )}

        {user && component === undefined && (
          <section className="bd-panel">
            <h2>Loading</h2>
            <p>Loading component metadata and related published tips...</p>
          </section>
        )}

        {user && component === null && (
          <section className="bd-panel">
            <h2>Not Found</h2>
            <p>
              Component <code>{componentId}</code> was not found in the latest
              graph version for this workspace.
            </p>
          </section>
        )}

        {user && component && (
          <>
            <section className="bd-panel">
              <h2>Component Metadata</h2>
              <p>
                Name <code>{component.component.name}</code> · project{' '}
                <code>{component.component.project}</code> ({component.project.type})
              </p>
              <p>
                Class <code>{component.component.className ?? '(unknown)'}</code> ·
                selector <code>{component.component.selector ?? '(none)'}</code> ·
                standalone{' '}
                <code>
                  {component.component.standalone === null
                    ? '(unknown)'
                    : String(component.component.standalone)}
                </code>
              </p>
              <p>
                File path <code>{component.component.filePath}</code>
              </p>
              <p>
                Graph version <code>v{component.graphVersionNumber}</code>
              </p>
            </section>

            <section className="bd-panel">
              <h2>Dependency Graph Context</h2>
              <p>
                Project-level edges for <code>{component.component.project}</code>.
              </p>
              <p>
                Internal dependency targets from this component:{' '}
                {component.component.dependencies.length > 0
                  ? component.component.dependencies.join(', ')
                  : 'none'}
              </p>
              <div className="bd-card-list">
                {component.dependenciesOut.map((dependency) => (
                  <article
                    key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>
                      Out: {dependency.sourceProject} → {dependency.targetProject}
                    </p>
                    <p>
                      ({dependency.viaFiles.length} via file
                      {dependency.viaFiles.length === 1 ? '' : 's'})
                    </p>
                  </article>
                ))}
                {component.dependenciesIn.map((dependency) => (
                  <article
                    key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>
                      In: {dependency.sourceProject} → {dependency.targetProject}
                    </p>
                    <p>
                      ({dependency.viaFiles.length} via file
                      {dependency.viaFiles.length === 1 ? '' : 's'})
                    </p>
                  </article>
                ))}
              </div>
              {component.dependenciesOut.length === 0 &&
                component.dependenciesIn.length === 0 && (
                  <p>No graph edges for this component's project.</p>
                )}
            </section>

            <section className="bd-panel">
              <h2>Related Published Tips</h2>
              <p>
                Tips linked to this exact component
                (workspace/project/component/file path) and currently in{' '}
                <code>published</code> state.
              </p>
              {component.relatedPublishedTips.length === 0 && (
                <p>No published tips are linked to this component yet.</p>
              )}
              <div className="bd-card-list">
                {component.relatedPublishedTips.map((tip) => (
                  <article key={tip.id} className="bd-card-item">
                    <p>
                      <code>{tip.slug}</code> · {tip.title} (r{tip.currentRevision})
                    </p>
                    <p>Updated {new Date(tip.updatedAt).toLocaleString()}</p>
                    <p>{tip.tags.length > 0 ? `Tags: ${tip.tags.join(', ')}` : 'No tags'}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bd-panel">
              <h2>Watchlist Notifications (BD-016)</h2>
              <p>
                Subscribe to receive in-app notifications when component-linked
                tips are published or updated.
              </p>
              <p>
                Watchers for this component:{' '}
                <code>{watchStatus ? watchStatus.watcherCount : 'loading'}</code>
              </p>
              <p>
                You are currently:{' '}
                <code>
                  {watchStatus
                    ? watchStatus.isWatching
                      ? 'watching'
                      : 'not watching'
                    : 'loading'}
                </code>
              </p>
              <p>
                <button
                  type="button"
                  disabled={!watchStatus || watchStatus.isWatching}
                  onClick={() => void updateWatchStatus('watch')}
                >
                  Watch component
                </button>{' '}
                <button
                  type="button"
                  disabled={!watchStatus || !watchStatus.isWatching}
                  onClick={() => void updateWatchStatus('unwatch')}
                >
                  Unwatch component
                </button>
              </p>
              {watchActionMessage && <p>{watchActionMessage}</p>}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
