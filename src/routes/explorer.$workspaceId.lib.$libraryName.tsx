import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { EntityList } from '@/components/ui/EntityList'
import { Panel } from '@/components/ui/Panel'
import { ExplorerLayout } from '@/features/explorer/ExplorerLayout'
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
    <ExplorerLayout
      description={
        <>
          Workspace <code className="app-code">{workspaceId}</code> · Library{' '}
          <code className="app-code">{libraryName}</code>
        </>
      }
      navLabel="Library navigation"
      navSlot={
        <>
          <Link
            className="app-btn-secondary w-full justify-start"
            params={{ workspaceId: workspaceRouteParam }}
            to="/explorer/$workspaceId"
          >
            Back to workspace
          </Link>
          <Link
            className="app-btn-secondary w-full justify-start"
            params={{ projectName: libraryName, workspaceId: workspaceRouteParam }}
            to="/explorer/$workspaceId/project/$projectName"
          >
            Open as project view
          </Link>
          <Link
            className="app-btn-secondary w-full justify-start"
            search={{ tab: 'overview' }}
            to="/dashboard"
          >
            Dashboard
          </Link>
        </>
      }
      sidebarMeta={<code className="app-code">{libraryName}</code>}
      sidebarTitle="Library View"
      title="Library Explorer"
    >
      {!user ? (
        <Panel title="Sign In Required">
          <Link className="app-btn" to="/login">
            Sign in with WorkOS
          </Link>
        </Panel>
      ) : null}

      {user && library === undefined ? (
        <Panel title="Loading">
          <p className="text-sm text-slate-300">Loading library graph details...</p>
        </Panel>
      ) : null}

      {user && library === null ? (
        <Panel title="Not Found">
          <p className="text-sm text-slate-300">
            Library <code className="app-code">{libraryName}</code> is not available in latest snapshot.
          </p>
        </Panel>
      ) : null}

      {user && library && !isLibrary ? (
        <Panel title="Type Mismatch">
          <p className="text-sm text-slate-300">
            <code className="app-code">{libraryName}</code> exists but is typed as{' '}
            <code className="app-code">{library.project.type}</code>, not library.
          </p>
        </Panel>
      ) : null}

      {user && library && isLibrary ? (
        <>
          <Panel title="Library Details">
            <p className="text-sm text-slate-300">
              {library.project.componentCount} components · graph version{' '}
              <code className="app-code">v{library.graphVersionNumber}</code>
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="app-card py-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Root path</dt>
                <dd className="mt-1">
                  <code className="app-code">{library.project.rootPath}</code>
                </dd>
              </div>
              <div className="app-card py-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Source root</dt>
                <dd className="mt-1">
                  <code className="app-code">{library.project.sourceRootPath ?? '(not configured)'}</code>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Components">
            <EntityList
              empty="No components found."
              getKey={(component) => component.id}
              items={library.components}
              renderItem={(component) => (
                <article className="app-card space-y-3">
                  <h3 className="font-display text-lg font-semibold text-white">{component.name}</h3>
                  <p className="text-xs text-slate-400">
                    {component.selector ? (
                      <code className="app-code">{component.selector}</code>
                    ) : (
                      '(no selector)'
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    <code className="app-code">{component.filePath}</code>
                  </p>
                  <Link
                    className="app-btn"
                    params={{ componentId: component.id, workspaceId: workspaceRouteParam }}
                    to="/explorer/$workspaceId/component/$componentId"
                  >
                    Open component detail
                  </Link>
                </article>
              )}
            />
          </Panel>

          <Panel title="Dependency Graph">
            {library.dependenciesOut.length === 0 && library.dependenciesIn.length === 0 ? (
              <p className="text-sm text-slate-300">No incoming or outgoing graph edges for this library.</p>
            ) : null}
            <EntityList
              empty=""
              getKey={(dependency) =>
                `${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`
              }
              items={[...library.dependenciesOut, ...library.dependenciesIn]}
              renderItem={(dependency) => (
                <article className="app-card space-y-2">
                  <p className="text-sm text-slate-100">
                    {dependency.sourceProject} → {dependency.targetProject}
                  </p>
                </article>
              )}
            />
          </Panel>
        </>
      ) : null}
    </ExplorerLayout>
  )
}
