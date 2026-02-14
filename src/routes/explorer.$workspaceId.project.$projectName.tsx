import { Link, createFileRoute } from '@tanstack/react-router'
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
    <ExplorerLayout
      description={
        <>
          Workspace <code className="app-code">{workspaceId}</code> · Project{' '}
          <code className="app-code">{projectName}</code>
        </>
      }
      navLabel="Project navigation"
      navSlot={
        <>
          <Link
            className="app-btn-secondary w-full justify-start"
            params={{ workspaceId: workspaceRouteParam }}
            to="/explorer/$workspaceId"
          >
            Back to workspace
          </Link>
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
        </>
      }
      sidebarMeta={<code className="app-code">{projectName}</code>}
      sidebarTitle="Project View"
      title="Project Explorer"
    >
      {!user ? (
        <Panel title="Sign In Required">
          <Link className="app-btn" to="/login">
            Sign in with WorkOS
          </Link>
        </Panel>
      ) : null}

      {user && project === undefined ? (
        <Panel title="Loading">
          <p className="text-sm text-slate-300">Loading project graph details...</p>
        </Panel>
      ) : null}

      {user && project === null ? (
        <Panel title="Not Found">
          <p className="text-sm text-slate-300">
            Project <code className="app-code">{projectName}</code> is not available in the latest graph snapshot.
          </p>
        </Panel>
      ) : null}

      {user && project ? (
        <>
          <Panel title="Project Details">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <StatusChip tone="info">{project.project.type}</StatusChip>
              <span>{project.project.componentCount} components</span>
              <span>
                graph version <code className="app-code">v{project.graphVersionNumber}</code>
              </span>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="app-card py-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Root path</dt>
                <dd className="mt-1">
                  <code className="app-code">{project.project.rootPath}</code>
                </dd>
              </div>
              <div className="app-card py-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Source root</dt>
                <dd className="mt-1">
                  <code className="app-code">{project.project.sourceRootPath ?? '(not configured)'}</code>
                </dd>
              </div>
              <div className="app-card py-3 sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Config file</dt>
                <dd className="mt-1">
                  <code className="app-code">{project.project.configFilePath}</code>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Components">
            <EntityList
              empty="No components found."
              getKey={(component) => component.id}
              items={project.components}
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
                    params={{
                      componentId: component.id,
                      workspaceId: workspaceRouteParam,
                    }}
                    to="/explorer/$workspaceId/component/$componentId"
                  >
                    Open component detail
                  </Link>
                </article>
              )}
            />
          </Panel>

          <Panel title="Dependency Graph: Outgoing">
            <EntityList
              empty="No outgoing dependencies from this project."
              getKey={(dependency) =>
                `out:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`
              }
              items={project.dependenciesOut}
              renderItem={(dependency) => (
                <article className="app-card space-y-2">
                  <p className="text-sm text-slate-100">
                    {dependency.sourceProject} → {dependency.targetProject}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dependency.viaFiles.length} via file{dependency.viaFiles.length === 1 ? '' : 's'}
                  </p>
                </article>
              )}
            />
          </Panel>

          <Panel title="Dependency Graph: Incoming">
            <EntityList
              empty="No incoming dependencies to this project."
              getKey={(dependency) =>
                `in:${dependency.sourceProject}:${dependency.targetProject}:${dependency.viaFiles[0] ?? 'edge'}`
              }
              items={project.dependenciesIn}
              renderItem={(dependency) => (
                <article className="app-card space-y-2">
                  <p className="text-sm text-slate-100">
                    {dependency.sourceProject} → {dependency.targetProject}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dependency.viaFiles.length} via file{dependency.viaFiles.length === 1 ? '' : 's'}
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
