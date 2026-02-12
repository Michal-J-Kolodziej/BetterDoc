import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'

export const Route = createFileRoute('/explorer/$workspaceId/lib/$libraryName')({
  ssr: false,
  component: ComponentExplorerLibraryPage,
})

function ComponentExplorerLibraryPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const { workspaceId, libraryName } = Route.useParams()
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
    <main>
      <h1>Library Explorer</h1>
      <p>
        Workspace <code>{workspaceId}</code> · Library <code>{libraryName}</code>
      </p>

      {!user && (
        <section>
          <h2>Sign In Required</h2>
          <p>
            <Link to="/login">Sign in with WorkOS</Link> to open library details.
          </p>
        </section>
      )}

      {user && library === undefined && (
        <section>
          <h2>Loading</h2>
          <p>Loading library graph details...</p>
        </section>
      )}

      {user && library === null && (
        <section>
          <h2>Not Found</h2>
          <p>
            Library <code>{libraryName}</code> is not available in the latest
            graph snapshot.
          </p>
        </section>
      )}

      {user && library && !isLibrary && (
        <section>
          <h2>Type Mismatch</h2>
          <p>
            <code>{libraryName}</code> exists but is typed as{' '}
            <code>{library.project.type}</code>, not library.
          </p>
        </section>
      )}

      {user && library && isLibrary && (
        <>
          <section>
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

          <section>
            <h2>Components</h2>
            {library.components.length === 0 && <p>No components found.</p>}
            {library.components.map((component) => (
              <p key={component.id}>
                <strong>{component.name}</strong>{' '}
                {component.selector ? <code>{component.selector}</code> : '(no selector)'}
                <br />
                <code>{component.filePath}</code>
                <br />
                <Link
                  to="/explorer/$workspaceId/component/$componentId"
                  params={{ workspaceId, componentId: component.id }}
                >
                  Open component detail
                </Link>
              </p>
            ))}
          </section>

          <section>
            <h2>Dependency Graph</h2>
            {library.dependenciesOut.length === 0 &&
              library.dependenciesIn.length === 0 && (
                <p>No incoming or outgoing graph edges for this library.</p>
              )}
            {library.dependenciesOut.map((dependency) => (
              <p
                key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                Out: {dependency.sourceProject} → {dependency.targetProject}
              </p>
            ))}
            {library.dependenciesIn.map((dependency) => (
              <p
                key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                In: {dependency.sourceProject} → {dependency.targetProject}
              </p>
            ))}
          </section>
        </>
      )}

      <section>
        <h2>Navigation</h2>
        <p>
          <Link to="/explorer/$workspaceId" params={{ workspaceId }}>
            Back to workspace
          </Link>
        </p>
        <p>
          <Link
            to="/explorer/$workspaceId/project/$projectName"
            params={{ workspaceId, projectName: libraryName }}
          >
            Open as project view
          </Link>
        </p>
      </section>
    </main>
  )
}
