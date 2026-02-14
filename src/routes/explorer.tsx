import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { EntityList } from '@/components/ui/EntityList'
import { Panel } from '@/components/ui/Panel'
import { StatusChip } from '@/components/ui/StatusChip'
import { ExplorerLayout } from '@/features/explorer/ExplorerLayout'
import { api } from '../../convex/_generated/api.js'
import { encodeWorkspaceRouteParam } from '../lib/workspace-route'

export const Route = createFileRoute('/explorer')({
  ssr: false,
  head: () => ({
    meta: [
      {
        title: 'Component Explorer | BetterDoc',
      },
    ],
  }),
  component: ComponentExplorerWorkspaceListPage,
})

function ComponentExplorerWorkspaceListPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isWorkspaceListRoute = pathname === '/explorer' || pathname === '/explorer/'
  const workspaces = useQuery(
    api.accessControl.listComponentExplorerWorkspaces,
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 20,
        }
      : 'skip',
  )

  if (!isWorkspaceListRoute) {
    return <Outlet />
  }

  return (
    <ExplorerLayout
      description="Browse the latest scanned workspace graph, then drill into projects, libraries, and components with linked published tips."
      navLabel="Explorer navigation"
      navSlot={
        <>
          <Link className="app-btn-secondary w-full justify-start" to="/explorer">
            All workspaces
          </Link>
          <Link
            className="app-btn-secondary w-full justify-start"
            search={{ tab: 'overview' }}
            to="/dashboard"
          >
            Dashboard
          </Link>
          <Link className="app-btn-secondary w-full justify-start" to="/">
            Home
          </Link>
        </>
      }
      sidebarMeta="Workspace graph navigation"
      sidebarTitle="Component Explorer"
      title="Workspace Directory"
    >
      {!user ? (
        <Panel title="Sign In Required">
          <p className="text-sm text-slate-300">
            <Link className="app-btn" to="/login">
              Sign in with WorkOS
            </Link>{' '}
            to open explorer data.
          </p>
        </Panel>
      ) : (
        <Panel title="Available Workspaces">
          {workspaces === undefined ? <p className="text-sm text-slate-300">Loading latest scan workspaces...</p> : null}
          {workspaces?.length === 0 ? (
            <p className="text-sm text-slate-300">
              No successful scan snapshots were found yet. Run scanner ingestion first.
            </p>
          ) : null}

          {workspaces ? (
            <EntityList
              empty="No workspaces yet."
              getKey={(workspace) => workspace.workspaceId}
              items={workspaces}
              renderItem={(workspace) => (
                <article className="app-card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-white">
                      <code className="app-code">{workspace.workspaceId}</code>
                    </h3>
                    <StatusChip tone="info">v{workspace.graphVersionNumber}</StatusChip>
                  </div>
                  <p className="text-sm text-slate-300">
                    {workspace.projectCount} projects · {workspace.libraryCount} libs · {workspace.componentCount}{' '}
                    components · {workspace.dependencyCount} edges
                  </p>
                  <p className="text-xs text-slate-400">
                    Scanned {new Date(workspace.completedAt).toLocaleString()}
                  </p>
                  <Link
                    className="app-btn"
                    params={{
                      workspaceId: encodeWorkspaceRouteParam(workspace.workspaceId),
                    }}
                    to="/explorer/$workspaceId"
                  >
                    Open workspace explorer
                  </Link>
                </article>
              )}
            />
          ) : null}
        </Panel>
      )}
    </ExplorerLayout>
  )
}
