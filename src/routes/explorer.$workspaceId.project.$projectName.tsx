import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'
import {
  decodeWorkspaceRouteParam,
  encodeWorkspaceRouteParam,
} from '../lib/workspace-route'

export const Route = createFileRoute('/explorer/$workspaceId/project/$projectName')({
  ssr: false,
  component: ComponentExplorerProjectPage,
})

function ComponentExplorerProjectPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const { workspaceId: workspaceIdParam, projectName } = Route.useParams()
  const workspaceId = decodeWorkspaceRouteParam(workspaceIdParam)
  const workspaceRouteParam = encodeWorkspaceRouteParam(workspaceId)
  const project = useQuery(
    api.accessControl.getComponentExplorerProject,
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId,
          projectName,
        }
      : 'skip',
  )

  return (
    <div className="bd-explorer-shell">
      <aside className="bd-explorer-sidebar">
        <div className="bd-sidebar-brand">
          <strong>Project View</strong>
          <span>
            <code>{projectName}</code>
          </span>
        </div>
        <nav className="bd-sidebar-nav" aria-label="Project navigation">
          <Link to="/explorer/$workspaceId" params={{ workspaceId: workspaceRouteParam }}>
            Back to workspace
          </Link>
          <Link to="/explorer">All workspaces</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </aside>

      <main className="bd-explorer-main">
        <header className="bd-page-header">
          <div>
            <h1>Project Explorer</h1>
            <p>
              Workspace <code>{workspaceId}</code> · Project{' '}
              <code>{projectName}</code>
            </p>
          </div>
        </header>

        {!user && (
          <section className="bd-panel">
            <h2>Sign In Required</h2>
            <p>
              <Link to="/login">Sign in with WorkOS</Link> to open project
              explorer details.
            </p>
          </section>
        )}

        {user && project === undefined && (
          <section className="bd-panel">
            <h2>Loading</h2>
            <p>Loading project graph details...</p>
          </section>
        )}

        {user && project === null && (
          <section className="bd-panel">
            <h2>Not Found</h2>
            <p>
              Project <code>{projectName}</code> is not available in the latest
              graph snapshot.
            </p>
          </section>
        )}

        {user && project && (
          <>
            <section className="bd-panel">
              <h2>Project Details</h2>
              <p>
                Type <code>{project.project.type}</code> ·{' '}
                {project.project.componentCount} components · graph version{' '}
                <code>v{project.graphVersionNumber}</code>
              </p>
              <p>
                Root path <code>{project.project.rootPath}</code>
              </p>
              <p>
                Source root{' '}
                <code>{project.project.sourceRootPath ?? '(not configured)'}</code>
              </p>
              <p>
                Config file <code>{project.project.configFilePath}</code>
              </p>
            </section>

            <section className="bd-panel">
              <h2>Components</h2>
              {project.components.length === 0 && <p>No components found.</p>}
              <div className="bd-card-list">
                {project.components.map((component) => (
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
              <h2>Dependency Graph: Outgoing</h2>
              {project.dependenciesOut.length === 0 && (
                <p>No outgoing dependencies from this project.</p>
              )}
              <div className="bd-card-list">
                {project.dependenciesOut.map((dependency) => (
                  <article
                    key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>
                      {dependency.sourceProject} → {dependency.targetProject}
                    </p>
                    <p>
                      ({dependency.viaFiles.length} via file
                      {dependency.viaFiles.length === 1 ? '' : 's'})
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bd-panel">
              <h2>Dependency Graph: Incoming</h2>
              {project.dependenciesIn.length === 0 && (
                <p>No incoming dependencies to this project.</p>
              )}
              <div className="bd-card-list">
                {project.dependenciesIn.map((dependency) => (
                  <article
                    key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
                    className="bd-card-item"
                  >
                    <p>
                      {dependency.sourceProject} → {dependency.targetProject}
                    </p>
                    <p>
                      ({dependency.viaFiles.length} via file
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
