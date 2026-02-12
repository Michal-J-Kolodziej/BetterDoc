import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/explorer/$workspaceId/component/$componentId')({
  ssr: false,
  component: ComponentExplorerComponentPage,
})

function ComponentExplorerComponentPage() {
  const auth = useAuth()
  const user = auth.user
  const organizationId = auth.organizationId ?? undefined
  const { workspaceId, componentId } = Route.useParams()
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

  return (
    <main>
      <h1>Component Detail</h1>
      <p>
        Workspace <code>{workspaceId}</code> · Component ID <code>{componentId}</code>
      </p>

      {!user && (
        <section>
          <h2>Sign In Required</h2>
          <p>
            <Link to="/login">Sign in with WorkOS</Link> to open component detail
            data.
          </p>
        </section>
      )}

      {user && component === undefined && (
        <section>
          <h2>Loading</h2>
          <p>Loading component metadata and related published tips...</p>
        </section>
      )}

      {user && component === null && (
        <section>
          <h2>Not Found</h2>
          <p>
            Component <code>{componentId}</code> was not found in the latest graph
            version for this workspace.
          </p>
        </section>
      )}

      {user && component && (
        <>
          <section>
            <h2>Component Metadata</h2>
            <p>
              Name <code>{component.component.name}</code> · project{' '}
              <code>{component.component.project}</code> ({component.project.type})
            </p>
            <p>
              Class <code>{component.component.className ?? '(unknown)'}</code> ·
              selector <code>{component.component.selector ?? '(none)'}</code> ·
              standalone{' '}
              <code>
                {component.component.standalone === null
                  ? '(unknown)'
                  : String(component.component.standalone)}
              </code>
            </p>
            <p>
              File path <code>{component.component.filePath}</code>
            </p>
            <p>
              Graph version <code>v{component.graphVersionNumber}</code>
            </p>
          </section>

          <section>
            <h2>Dependency Graph Context</h2>
            <p>
              Project-level edges for <code>{component.component.project}</code>.
            </p>
            <p>
              Internal dependency targets from this component:{' '}
              {component.component.dependencies.length > 0
                ? component.component.dependencies.join(', ')
                : 'none'}
            </p>
            {component.dependenciesOut.map((dependency) => (
              <p
                key={`out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                Out: {dependency.sourceProject} → {dependency.targetProject} (
                {dependency.viaFiles.length} via file
                {dependency.viaFiles.length === 1 ? '' : 's'})
              </p>
            ))}
            {component.dependenciesIn.map((dependency) => (
              <p
                key={`in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`}
              >
                In: {dependency.sourceProject} → {dependency.targetProject} (
                {dependency.viaFiles.length} via file
                {dependency.viaFiles.length === 1 ? '' : 's'})
              </p>
            ))}
            {component.dependenciesOut.length === 0 &&
              component.dependenciesIn.length === 0 && (
                <p>No graph edges for this component's project.</p>
              )}
          </section>

          <section>
            <h2>Related Published Tips</h2>
            <p>
              Tips linked to this exact component (workspace/project/component/file
              path) and currently in <code>published</code> state.
            </p>
            {component.relatedPublishedTips.length === 0 && (
              <p>No published tips are linked to this component yet.</p>
            )}
            {component.relatedPublishedTips.map((tip) => (
              <p key={tip.id}>
                <code>{tip.slug}</code> · {tip.title} (r{tip.currentRevision}) ·
                updated {new Date(tip.updatedAt).toLocaleString()}
                <br />
                {tip.tags.length > 0 ? `Tags: ${tip.tags.join(', ')}` : 'No tags'}
              </p>
            ))}
          </section>
        </>
      )}

      <section>
        <h2>Navigation</h2>
        {component && (
          <p>
            <Link
              to="/explorer/$workspaceId/project/$projectName"
              params={{
                workspaceId,
                projectName: component.component.project,
              }}
            >
              Back to project
            </Link>
          </p>
        )}
        <p>
          <Link to="/explorer/$workspaceId" params={{ workspaceId }}>
            Back to workspace
          </Link>
        </p>
        <p>
          <Link to="/dashboard">Dashboard</Link>
        </p>
      </section>
    </main>
  )
}
