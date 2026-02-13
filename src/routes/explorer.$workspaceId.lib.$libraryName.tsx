import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'
import {
  decodeWorkspaceRouteParam,
  encodeWorkspaceRouteParam,
} from '../lib/workspace-route'

export const Route = createFileRoute('/explorer/$workspaceId/lib/$libraryName')({
  ssr: false,
  component: ComponentExplorerLibraryPage,
})

function ComponentExplorerLibraryPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const { workspaceId: workspaceIdParam, libraryName } = Route.useParams()
  const workspaceId = decodeWorkspaceRouteParam(workspaceIdParam)
  const workspaceRouteParam = encodeWorkspaceRouteParam(workspaceId)
  const library = useQuery(
    api.accessControl.getComponentExplorerProject,
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
          projectName: libraryName,
        }
      : 'skip',
  )

  const isLibrary = library?.project.type === 'library'

  return (
    <div className="bd-explorer-shell">
      <aside className="bd-explorer-sidebar">
        <div className="bd-sidebar-brand">
          <strong>Library View</strong>
          <span>
            <code>{libraryName}</code>
          </span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Library navigation">
          <Link to="/explorer/$workspaceId" params={{ workspaceId: workspaceRouteParam }}>
            Back to workspace
          </Link>
          <Link
            to="/explorer/$workspaceId/project/$projectName"
            params={{ workspaceId: workspaceRouteParam, projectName: libraryName }}
          >
            Open as project view
          </Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </aside>

      <main className="bd-explorer-main">
        <header className="bd-page-header">
          <div>
            <h1>Library Explorer</h1>
            <p>
              Workspace <code>{workspaceId}</code> · Library{' '}
              <code>{libraryName}</code>
            </p>
          </div>
        </header>

        {!user && (
          <section className="bd-panel">
            <h2>Sign In Required</h2>
            <p>
              <Link to="/login">Sign in with WorkOS</Link> to open library
              details.
            </p>
          </section>
        )}

        {user && library === undefined && (
          <section className="bd-panel">
            <h2>Loading</h2>
            <p>Loading library graph details...</p>
          </section>
        )}

        {user && library === null && (
          <section className="bd-panel">
            <h2>Not Found</h2>
            <p>
              Library <code>{libraryName}</code> is not available in the latest
              graph snapshot.
            </p>
          </section>
        )}

        {user && library && !isLibrary && (
          <section className="bd-panel">
            <h2>Type Mismatch</h2>
            <p>
              <code>{libraryName}</code> exists but is typed as{' '}
              <code>{library.project.type}</code>, not library.
            </p>
          </section>
        )}

        {user && library && isLibrary && (
          <>
            <section className="bd-panel">
              <h2>Library Details</h2>
              <p>
                {library.project.componentCount} components · graph version{' '}
                <code>v{library.graphVersionNumber}</code>
              </p>
              <p>
                Root path <code>{library.project.rootPath}</code>
              </p>
              <p>
                Source root{' '}
                <code>{library.project.sourceRootPath ?? '(not configured)'}</code>
              </p>
            </section>

            <section className="bd-panel">
              <h2>Components</h2>
              {library.components.length === 0 && <p>No components found.</p>}
              <div className="bd-card-list">
                {library.components.map((component) => (
                  <article key={component.id} className="bd-card-item">
                    <h3>{component.name}</h3>
                    <p>
                      {component.selector ? (
                        <code>{component.selector}</code>
                      ) : (
                        '(no selector)'
                      )}
                    </p>
                    <p>
                      <code>{component.filePath}</code>
                    </p>
                    <p>
                      <Link
                        to="/explorer/$workspaceId/component/$componentId"
                        params={{
                          workspaceId: workspaceRouteParam,
                          componentId: component.id,
                        }}
                      >
                        Open component detail
                      </Link>
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bd-panel">
              <h2>Dependency Graph</h2>
              {library.dependenciesOut.length === 0 &&
                library.dependenciesIn.length === 0 && (
                  <p>No incoming or outgoing graph edges for this library.</p>
                )}
              <div className="bd-card-list">
                {library.dependenciesOut.map((dependency) => (
                  <article
                    key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>Out: {dependency.sourceProject} → {dependency.targetProject}</p>
                  </article>
                ))}
                {library.dependenciesIn.map((dependency) => (
                  <article
                    key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>In: {dependency.sourceProject} → {dependency.targetProject}</p>
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
