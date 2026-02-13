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
    <main>
      <h1>Component Explorer</h1>
      <p>
        Browse the latest scanned workspace graph, drill into projects/libraries,
        and open component detail views with linked published tips.
      </p>

      {!user && (
        <section>
          <h2>Sign In Required</h2>
          <p>
            <Link to="/login">Sign in with WorkOS</Link> to open component explorer
            data.
          </p>
        </section>
      )}

      {user && (
        <section>
          <h2>Available Workspaces</h2>
          {workspaces === undefined && <p>Loading latest scan workspaces...</p>}
          {workspaces?.length === 0 && (
            <p>
              No successful scan snapshots were found yet. Run the scanner ingest
              pipeline first.
            </p>
          )}
          {workspaces?.map((workspace) => (
            <p key={workspace.workspaceId}>
              <strong>{workspace.workspaceId}</strong> · v{workspace.graphVersionNumber}{' '}
              ({workspace.projectCount} projects, {workspace.libraryCount} libs,{' '}
              {workspace.componentCount} components, {workspace.dependencyCount}{' '}
              edges) · scanned {new Date(workspace.completedAt).toLocaleString()}
              <br />
              <Link
                to="/explorer/$workspaceId"
                params={{
                  workspaceId: encodeWorkspaceRouteParam(workspace.workspaceId),
                }}
              >
                Open workspace explorer
              </Link>
            </p>
          ))}
        </section>
      )}

      <section>
        <h2>Navigation</h2>
        <p>
          <Link to="/dashboard">Back to dashboard</Link>
        </p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  )
}
