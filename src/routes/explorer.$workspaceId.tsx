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
    <main>
      <h1>Workspace Explorer</h1>
      <p>
        Workspace: <code>{workspaceId}</code>
      </p>

      {!user && (
        <section>
          <h2>Sign In Required</h2>
          <p>
            <Link to="/login">Sign in with WorkOS</Link> to browse project and
            component graph data.
          </p>
        </section>
      )}

      {user && workspace === undefined && (
        <section>
          <h2>Loading</h2>
          <p>Fetching latest graph snapshot for this workspace...</p>
        </section>
      )}

      {user && workspace === null && (
        <section>
          <h2>No Snapshot Found</h2>
          <p>
            No successful scan snapshot exists for <code>{workspaceId}</code>.
          </p>
        </section>
      )}

      {user && workspace && (
        <>
          <section>
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
              {workspace.componentCount} components · {workspace.dependencyCount}{' '}
              edges
            </p>
          </section>

          <section>
            <h2>Projects</h2>
            {workspace.projects.length === 0 && <p>No projects in this snapshot.</p>}
            {workspace.projects.map((project) => (
              <p key={project.name}>
                <code>{project.name}</code> ({project.type}) ·{' '}
                {project.componentCount} components
                <br />
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
            ))}
          </section>

          <section>
            <h2>Libraries</h2>
            {workspace.libraries.length === 0 && (
              <p>No library-type projects in this snapshot.</p>
            )}
            {workspace.libraries.map((library) => (
              <p key={library.name}>
                <code>{library.name}</code> · {library.componentCount} components
                <br />
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
            ))}
          </section>

          <section>
            <h2>Dependency Graph</h2>
            <p>
              Directed edges between projects/libraries in the latest graph
              snapshot.
            </p>
            {workspace.dependencies.length === 0 && (
              <p>No dependency edges in this snapshot.</p>
            )}
            {workspace.dependencies.map((dependency) => (
              <p
                key={`${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
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
                </Link>{' '}
                ({dependency.viaFiles.length} import file
                {dependency.viaFiles.length === 1 ? '' : 's'})
              </p>
            ))}
          </section>
        </>
      )}

      <section>
        <h2>Navigation</h2>
        <p>
          <Link to="/explorer">All workspaces</Link>
        </p>
        <p>
          <Link to="/dashboard">Dashboard</Link>
        </p>
      </section>
    </main>
  )
}
