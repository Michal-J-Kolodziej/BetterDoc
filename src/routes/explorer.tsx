import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'
import { encodeWorkspaceRouteParam } from '../lib/workspace-route'

export const Route = createFileRoute('/explorer')({
  ssr: false,
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
    <div className="bd-explorer-shell">
      <aside className="bd-explorer-sidebar">
        <div className="bd-sidebar-brand">
          <strong>Component Explorer</strong>
          <span>Workspace graph navigation</span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Explorer navigation">
          <Link to="/explorer">All workspaces</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/">Home</Link>
        </nav>
      </aside>

      <main className="bd-explorer-main">
        <header className="bd-page-header">
          <div>
            <h1>Workspace Directory</h1>
            <p>
              Browse the latest scanned workspace graph, drill into
              projects/libraries, and open component detail views with linked
              published tips.
            </p>
          </div>
        </header>

        {!user && (
          <section className="bd-panel">
            <h2>Sign In Required</h2>
            <p>
              <Link to="/login">Sign in with WorkOS</Link> to open component
              explorer data.
            </p>
          </section>
        )}

        {user && (
          <section className="bd-panel">
            <h2>Available Workspaces</h2>
            {workspaces === undefined && <p>Loading latest scan workspaces...</p>}
            {workspaces?.length === 0 && (
              <p>
                No successful scan snapshots were found yet. Run the scanner
                ingest pipeline first.
              </p>
            )}
            <div className="bd-card-list">
              {workspaces?.map((workspace) => (
                <article key={workspace.workspaceId} className="bd-card-item">
                  <h3>
                    <code>{workspace.workspaceId}</code>
                  </h3>
                  <p>
                    v{workspace.graphVersionNumber} · {workspace.projectCount}{' '}
                    projects · {workspace.libraryCount} libs ·{' '}
                    {workspace.componentCount} components ·{' '}
                    {workspace.dependencyCount} edges
                  </p>
                  <p>Scanned {new Date(workspace.completedAt).toLocaleString()}</p>
                  <p>
                    <Link
                      to="/explorer/$workspaceId"
                      params={{
                        workspaceId: encodeWorkspaceRouteParam(
                          workspace.workspaceId,
                        ),
                      }}
                    >
                      Open workspace explorer
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
