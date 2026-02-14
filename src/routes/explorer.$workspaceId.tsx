import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useQuery } from 'convex/react'

import { EntityList } from '@/components/ui/EntityList'
import { Panel } from '@/components/ui/Panel'
import { StatusChip } from '@/components/ui/StatusChip'
import { ExplorerLayout } from '@/features/explorer/ExplorerLayout'
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
    <ExplorerLayout
      description={
        <>
          Workspace <code className="app-code">{workspaceId}</code>
        </>
      }
      navLabel="Workspace navigation"
      navSlot={
        <>
          <Link className="app-btn-secondary w-full justify-start" to="/explorer">
            All workspaces
          </Link>
          <Link
            className="app-btn-secondary w-full justify-start"
            search={{ tab: 'overview' }}
            to="/dashboard"
          >
            Dashboard
          </Link>
          <Link className="app-btn-secondary w-full justify-start" to="/">
            Home
          </Link>
        </>
      }
      sidebarMeta={<code className="app-code">{workspaceId}</code>}
      sidebarTitle="Workspace"
      title="Workspace Explorer"
    >
      {!user ? (
        <Panel title="Sign In Required">
          <Link className="app-btn" to="/login">
            Sign in with WorkOS
          </Link>
        </Panel>
      ) : null}

      {user && workspace === undefined ? (
        <Panel title="Loading">
          <p className="text-sm text-slate-300">Fetching latest graph snapshot for this workspace...</p>
        </Panel>
      ) : null}

      {user && workspace === null ? (
        <Panel title="No Snapshot Found">
          <p className="text-sm text-slate-300">
            No successful scan snapshot exists for <code className="app-code">{workspaceId}</code>.
          </p>
        </Panel>
      ) : null}

      {user && workspace ? (
        <>
          <Panel title="Latest Graph Version">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <StatusChip tone="info">v{workspace.graphVersionNumber}</StatusChip>
              <span>
                scanner <code className="app-code">{workspace.scannerName}</code>
                {workspace.scannerVersion ? (
                  <>
                    {' '}
                    v<code className="app-code">{workspace.scannerVersion}</code>
                  </>
                ) : null}
              </span>
              <span>
                source <code className="app-code">{workspace.source}</code>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Completed {new Date(workspace.completedAt).toLocaleString()} · {workspace.projectCount} projects ·{' '}
              {workspace.libraryCount} libs · {workspace.componentCount} components · {workspace.dependencyCount}{' '}
              edges
            </p>
          </Panel>

          <Panel title="Projects">
            <EntityList
              empty="No projects in this snapshot."
              getKey={(project) => project.name}
              items={workspace.projects}
              renderItem={(project) => (
                <article className="app-card space-y-3">
                  <p className="text-sm text-slate-100">
                    <code className="app-code">{project.name}</code> ({project.type})
                  </p>
                  <p className="text-sm text-slate-300">{project.componentCount} components</p>
                  <Link
                    className="app-btn"
                    params={{
                      projectName: project.name,
                      workspaceId: workspaceRouteParam,
                    }}
                    to="/explorer/$workspaceId/project/$projectName"
                  >
                    Open project view
                  </Link>
                </article>
              )}
            />
          </Panel>

          <Panel title="Libraries">
            <EntityList
              empty="No library-type projects in this snapshot."
              getKey={(library) => library.name}
              items={workspace.libraries}
              renderItem={(library) => (
                <article className="app-card space-y-3">
                  <p className="text-sm text-slate-100">
                    <code className="app-code">{library.name}</code>
                  </p>
                  <p className="text-sm text-slate-300">{library.componentCount} components</p>
                  <Link
                    className="app-btn"
                    params={{
                      libraryName: library.name,
                      workspaceId: workspaceRouteParam,
                    }}
                    to="/explorer/$workspaceId/lib/$libraryName"
                  >
                    Open library view
                  </Link>
                </article>
              )}
            />
          </Panel>

          <Panel
            description="Directed edges between projects/libraries in the latest graph snapshot."
            title="Dependency Graph"
          >
            <EntityList
              empty="No dependency edges in this snapshot."
              getKey={(dependency) =>
                `${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`
              }
              items={workspace.dependencies}
              renderItem={(dependency) => (
                <article className="app-card space-y-3">
                  <p className="text-sm text-slate-100">
                    <Link
                      params={{
                        projectName: dependency.sourceProject,
                        workspaceId: workspaceRouteParam,
                      }}
                      to="/explorer/$workspaceId/project/$projectName"
                    >
                      {dependency.sourceProject}
                    </Link>{' '}
                    →{' '}
                    <Link
                      params={{
                        projectName: dependency.targetProject,
                        workspaceId: workspaceRouteParam,
                      }}
                      to="/explorer/$workspaceId/project/$projectName"
                    >
                      {dependency.targetProject}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-400">
                    {dependency.viaFiles.length} import file
                    {dependency.viaFiles.length === 1 ? '' : 's'}
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
