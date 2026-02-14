import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { EntityList } from '@/components/ui/EntityList'
import { Panel } from '@/components/ui/Panel'
import { StatusChip } from '@/components/ui/StatusChip'
import { ExplorerLayout } from '@/features/explorer/ExplorerLayout'
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
    <ExplorerLayout
      description={
        <>
          Workspace <code className="app-code">{workspaceId}</code> · Component ID{' '}
          <code className="app-code">{componentId}</code>
        </>
      }
      navLabel="Component navigation"
      navSlot={
        <>
          {component ? (
            <Link
              className="app-btn-secondary w-full justify-start"
              params={{
                projectName: component.component.project,
                workspaceId: workspaceRouteParam,
              }}
              to="/explorer/$workspaceId/project/$projectName"
            >
              Back to project
            </Link>
          ) : null}
          <Link
            className="app-btn-secondary w-full justify-start"
            params={{ workspaceId: workspaceRouteParam }}
            to="/explorer/$workspaceId"
          >
            Back to workspace
          </Link>
          <Link
            className="app-btn-secondary w-full justify-start"
            search={{ tab: 'overview' }}
            to="/dashboard"
          >
            Dashboard
          </Link>
        </>
      }
      sidebarMeta={<code className="app-code">{componentId}</code>}
      sidebarTitle="Component Detail"
      title="Component Detail"
    >
      {!user ? (
        <Panel title="Sign In Required">
          <Link className="app-btn" to="/login">
            Sign in with WorkOS
          </Link>
        </Panel>
      ) : null}

      {user && component === undefined ? (
        <Panel title="Loading">
          <p className="text-sm text-slate-300">Loading component metadata and related published tips...</p>
        </Panel>
      ) : null}

      {user && component === null ? (
        <Panel title="Not Found">
          <p className="text-sm text-slate-300">
            Component <code className="app-code">{componentId}</code> was not found in latest graph version.
          </p>
        </Panel>
      ) : null}

      {user && component ? (
        <>
          <Panel title="Component Metadata">
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Name <code className="app-code">{component.component.name}</code> · project{' '}
                <code className="app-code">{component.component.project}</code> ({component.project.type})
              </p>
              <p>
                Class <code className="app-code">{component.component.className ?? '(unknown)'}</code> · selector{' '}
                <code className="app-code">{component.component.selector ?? '(none)'}</code> · standalone{' '}
                <code className="app-code">
                  {component.component.standalone === null
                    ? '(unknown)'
                    : String(component.component.standalone)}
                </code>
              </p>
              <p>
                File path <code className="app-code">{component.component.filePath}</code>
              </p>
              <p>
                Graph version <code className="app-code">v{component.graphVersionNumber}</code>
              </p>
            </div>
          </Panel>

          <Panel
            description={
              <>
                Project-level edges for <code className="app-code">{component.component.project}</code>
              </>
            }
            title="Dependency Graph Context"
          >
            <p className="text-sm text-slate-300">
              Internal dependency targets:{' '}
              {component.component.dependencies.length > 0
                ? component.component.dependencies.join(', ')
                : 'none'}
            </p>
            <EntityList
              empty="No graph edges for this component's project."
              getKey={(dependency) =>
                `${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`
              }
              items={[...component.dependenciesOut, ...component.dependenciesIn]}
              renderItem={(dependency) => (
                <article className="app-card space-y-2">
                  <p className="text-sm text-slate-100">
                    {dependency.sourceProject} → {dependency.targetProject}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dependency.viaFiles.length} via file{dependency.viaFiles.length === 1 ? '' : 's'}
                  </p>
                </article>
              )}
            />
          </Panel>

          <Panel
            description="Tips linked to this exact component (workspace/project/component/file path) and currently in published state."
            title="Related Published Tips"
          >
            <EntityList
              empty="No published tips are linked to this component yet."
              getKey={(tip) => tip.id}
              items={component.relatedPublishedTips}
              renderItem={(tip) => (
                <article className="app-card space-y-2">
                  <p className="text-sm text-slate-100">
                    <code className="app-code">{tip.slug}</code> · {tip.title} (r{tip.currentRevision})
                  </p>
                  <p className="text-xs text-slate-400">Updated {new Date(tip.updatedAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">
                    {tip.tags.length > 0 ? `Tags: ${tip.tags.join(', ')}` : 'No tags'}
                  </p>
                </article>
              )}
            />
          </Panel>

          <Panel
            description="Subscribe to receive in-app notifications when component-linked tips are published or updated."
            title="Watchlist Notifications"
          >
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Watchers for this component:{' '}
                <StatusChip tone="info">{watchStatus ? watchStatus.watcherCount : 'loading'}</StatusChip>
              </p>
              <p>
                You are currently:{' '}
                <StatusChip tone={watchStatus?.isWatching ? 'success' : 'default'}>
                  {watchStatus
                    ? watchStatus.isWatching
                      ? 'watching'
                      : 'not watching'
                    : 'loading'}
                </StatusChip>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="app-btn"
                  disabled={!watchStatus || watchStatus.isWatching}
                  onClick={() => void updateWatchStatus('watch')}
                  type="button"
                >
                  Watch component
                </button>
                <button
                  className="app-btn-secondary"
                  disabled={!watchStatus || !watchStatus.isWatching}
                  onClick={() => void updateWatchStatus('unwatch')}
                  type="button"
                >
                  Unwatch component
                </button>
              </div>
              {watchActionMessage ? <p className="text-cyan-100">{watchActionMessage}</p> : null}
            </div>
          </Panel>
        </>
      ) : null}
    </ExplorerLayout>
  )
}
