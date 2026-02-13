import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'
import {
  decodeWorkspaceRouteParam,
  encodeWorkspaceRouteParam,
} from '../lib/workspace-route'

export const Route = createFileRoute('/explorer/$workspaceId')({
  ssr: false,
  component: ComponentExplorerWorkspacePage,
})

function ComponentExplorerWorkspacePage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const { workspaceId: workspaceIdParam } = Route.useParams()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isWorkspaceOverviewRoute =
    pathname === `/explorer/${workspaceIdParam}` ||
    pathname === `/explorer/${workspaceIdParam}/`
  const workspaceId = decodeWorkspaceRouteParam(workspaceIdParam)
  const workspaceRouteParam = encodeWorkspaceRouteParam(workspaceId)
  const workspace = useQuery(
    api.accessControl.getComponentExplorerWorkspace,
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
        }
      : 'skip',
  )

  if (!isWorkspaceOverviewRoute) {
    return <Outlet />
  }

  return (
    <div className="bd-explorer-shell">
      <aside className="bd-explorer-sidebar">
        <div className="bd-sidebar-brand">
          <strong>Workspace</strong>
          <span>
            <code>{workspaceId}</code>
          </span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Workspace navigation">
          <Link to="/explorer">All workspaces</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/">Home</Link>
        </nav>
      </aside>

      <main className="bd-explorer-main">
        <header className="bd-page-header">
          <div>
            <h1>Workspace Explorer</h1>
            <p>
              Workspace: <code>{workspaceId}</code>
            </p>
          </div>
        </header>

        {!user && (
          <section className="bd-panel">
            <h2>Sign In Required</h2>
            <p>
              <Link to="/login">Sign in with WorkOS</Link> to browse project and
              component graph data.
            </p>
          </section>
        )}

        {user && workspace === undefined && (
          <section className="bd-panel">
            <h2>Loading</h2>
            <p>Fetching latest graph snapshot for this workspace...</p>
          </section>
        )}

        {user && workspace === null && (
          <section className="bd-panel">
            <h2>No Snapshot Found</h2>
            <p>
              No successful scan snapshot exists for <code>{workspaceId}</code>.
            </p>
          </section>
        )}

        {user && workspace && (
          <>
            <section className="bd-panel">
              <h2>Latest Graph Version</h2>
              <p>
                Graph version <code>v{workspace.graphVersionNumber}</code> · scanner{' '}
                <code>{workspace.scannerName}</code>{' '}
                {workspace.scannerVersion ? (
                  <>
                    v<code>{workspace.scannerVersion}</code>
                  </>
                ) : (
                  ''
                )}{' '}
                · source <code>{workspace.source}</code>
              </p>
              <p>
                Completed {new Date(workspace.completedAt).toLocaleString()} ·{' '}
                {workspace.projectCount} projects · {workspace.libraryCount} libs ·{' '}
                {workspace.componentCount} components ·{' '}
                {workspace.dependencyCount} edges
              </p>
            </section>

            <section className="bd-panel">
              <h2>Projects</h2>
              {workspace.projects.length === 0 && (
                <p>No projects in this snapshot.</p>
              )}
              <div className="bd-card-list">
                {workspace.projects.map((project) => (
                  <article key={project.name} className="bd-card-item">
                    <h3>
                      <code>{project.name}</code> ({project.type})
                    </h3>
                    <p>{project.componentCount} components</p>
                    <p>
                      <Link
                        to="/explorer/$workspaceId/project/$projectName"
                        params={{
                          workspaceId: workspaceRouteParam,
                          projectName: project.name,
                        }}
                      >
                        Open project view
                      </Link>
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bd-panel">
              <h2>Libraries</h2>
              {workspace.libraries.length === 0 && (
                <p>No library-type projects in this snapshot.</p>
              )}
              <div className="bd-card-list">
                {workspace.libraries.map((library) => (
                  <article key={library.name} className="bd-card-item">
                    <h3>
                      <code>{library.name}</code>
                    </h3>
                    <p>{library.componentCount} components</p>
                    <p>
                      <Link
                        to="/explorer/$workspaceId/lib/$libraryName"
                        params={{
                          workspaceId: workspaceRouteParam,
                          libraryName: library.name,
                        }}
                      >
                        Open library view
                      </Link>
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bd-panel">
              <h2>Dependency Graph</h2>
              <p>
                Directed edges between projects/libraries in the latest graph
                snapshot.
              </p>
              {workspace.dependencies.length === 0 && (
                <p>No dependency edges in this snapshot.</p>
              )}
              <div className="bd-card-list">
                {workspace.dependencies.map((dependency) => (
                  <article
                    key={`${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>
                      <Link
                        to="/explorer/$workspaceId/project/$projectName"
                        params={{
                          workspaceId: workspaceRouteParam,
                          projectName: dependency.sourceProject,
                        }}
                      >
                        {dependency.sourceProject}
                      </Link>{' '}
                      →{' '}
                      <Link
                        to="/explorer/$workspaceId/project/$projectName"
                        params={{
                          workspaceId: workspaceRouteParam,
                          projectName: dependency.targetProject,
                        }}
                      >
                        {dependency.targetProject}
                      </Link>
                    </p>
                    <p>
                      ({dependency.viaFiles.length} import file
                      {dependency.viaFiles.length === 1 ? '' : 's'})
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
