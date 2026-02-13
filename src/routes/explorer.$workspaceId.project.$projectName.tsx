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
    <main>
      <h1>Project Explorer</h1>
      <p>
        Workspace <code>{workspaceId}</code> · Project <code>{projectName}</code>
      </p>

      {!user && (
        <section>
          <h2>Sign In Required</h2>
          <p>
            <Link to="/login">Sign in with WorkOS</Link> to open project explorer
            details.
          </p>
        </section>
      )}

      {user && project === undefined && (
        <section>
          <h2>Loading</h2>
          <p>Loading project graph details...</p>
        </section>
      )}

      {user && project === null && (
        <section>
          <h2>Not Found</h2>
          <p>
            Project <code>{projectName}</code> is not available in the latest
            graph snapshot.
          </p>
        </section>
      )}

      {user && project && (
        <>
          <section>
            <h2>Project Details</h2>
            <p>
              Type <code>{project.project.type}</code> · {project.project.componentCount}{' '}
              components · graph version <code>v{project.graphVersionNumber}</code>
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

          <section>
            <h2>Components</h2>
            {project.components.length === 0 && <p>No components found.</p>}
            {project.components.map((component) => (
              <p key={component.id}>
                <strong>{component.name}</strong>{' '}
                {component.selector ? <code>{component.selector}</code> : '(no selector)'}
                <br />
                <code>{component.filePath}</code>
                <br />
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
            ))}
          </section>

          <section>
            <h2>Dependency Graph: Outgoing</h2>
            {project.dependenciesOut.length === 0 && (
              <p>No outgoing dependencies from this project.</p>
            )}
            {project.dependenciesOut.map((dependency) => (
              <p
                key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                {dependency.sourceProject} → {dependency.targetProject} (
                {dependency.viaFiles.length} via file
                {dependency.viaFiles.length === 1 ? '' : 's'})
              </p>
            ))}
          </section>

          <section>
            <h2>Dependency Graph: Incoming</h2>
            {project.dependenciesIn.length === 0 && (
              <p>No incoming dependencies to this project.</p>
            )}
            {project.dependenciesIn.map((dependency) => (
              <p
                key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                {dependency.sourceProject} → {dependency.targetProject} (
                {dependency.viaFiles.length} via file
                {dependency.viaFiles.length === 1 ? '' : 's'})
              </p>
            ))}
          </section>
        </>
      )}

      <section>
        <h2>Navigation</h2>
        <p>
          <Link to="/explorer/$workspaceId" params={{ workspaceId: workspaceRouteParam }}>
            Back to workspace
          </Link>
        </p>
        <p>
          <Link to="/explorer">All workspaces</Link>
        </p>
      </section>
    </main>
  )
}
