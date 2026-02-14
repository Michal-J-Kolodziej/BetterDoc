import type { ReactNode } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { AppShell } from '@/components/ui/AppShell'
import { PageTopbar } from '@/components/ui/PageTopbar'
import { SidebarRail } from '@/components/ui/SidebarRail'
import { DashboardTabs } from '@/features/dashboard/DashboardTabs'
import { AuditPanel } from '@/features/dashboard/panels/AuditPanel'
import { OverviewPanel } from '@/features/dashboard/panels/OverviewPanel'
import { SearchPanel } from '@/features/dashboard/panels/SearchPanel'
import { TipStudioPanel } from '@/features/dashboard/panels/TipStudioPanel'
import { WatchlistPanel } from '@/features/dashboard/panels/WatchlistPanel'
import { WorkflowPanel } from '@/features/dashboard/panels/WorkflowPanel'
import {
  createEmptyTipSearchState,
  getTipComponentLinkKey,
  parseDashboardTab,
  type DashboardTab,
  dashboardTabs,
  type TipComponentLink,
  type TipSearchState,
  validateTipSearchState,
} from '@/features/dashboard/types'
import { cn } from '@/lib/classnames'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import { hasPermission, type AppRole, type Permission } from '../lib/rbac'
import { encodeWorkspaceRouteParam } from '../lib/workspace-route'
import {
  buildTipDraftPayload,
  createEmptyTipEditorState,
  type TipEditorFormState,
  type TipEditorValidationErrors,
} from '../lib/tip-editor'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === undefined ? undefined : parseDashboardTab(search.tab),
  }),
  server: {
    handlers: {
      GET: async ({ context, next, request }) => {
        const auth = context.auth()

        if (!auth.user) {
          const authkit = await getAuthkit()
          const signInUrl = await authkit.getSignInUrl({
            returnPathname: new URL(request.url).pathname,
            redirectUri: context.redirectUri,
          })

          return Response.redirect(signInUrl, 307)
        }

        return next()
      },
    },
  },
  component: DashboardPage,
})

function DashboardPage() {
  const auth = useAuth()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const activeTab = parseDashboardTab(search.tab)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [tipEditorMessage, setTipEditorMessage] = useState<string | null>(null)
  const [draftTipId, setDraftTipId] = useState<Id<'tips'> | null>(null)
  const [tipEditorState, setTipEditorState] = useState<TipEditorFormState>(
    createEmptyTipEditorState,
  )
  const [tipValidationErrors, setTipValidationErrors] =
    useState<TipEditorValidationErrors>({})
  const [tipSearchState, setTipSearchState] = useState<TipSearchState>(
    createEmptyTipSearchState,
  )
  const [targetWorkosUserId, setTargetWorkosUserId] = useState('')
  const [nextRole, setNextRole] = useState<AppRole>('Reader')
  const [tipComponentLinks, setTipComponentLinks] = useState<TipComponentLink[]>([])
  const [tipComponentMessage, setTipComponentMessage] = useState<string | null>(null)
  const [linkWorkspaceId, setLinkWorkspaceId] = useState('')
  const [linkProjectName, setLinkProjectName] = useState('')
  const [linkComponentId, setLinkComponentId] = useState('')
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [showUnreadNotificationsOnly, setShowUnreadNotificationsOnly] =
    useState(false)

  const bootstrapFirstAdmin = useMutation(api.accessControl.bootstrapFirstAdmin)
  const assignRole = useMutation(api.accessControl.assignRole)
  const saveTipDraft = useMutation(api.accessControl.saveTipDraft)
  const submitTipForReview = useMutation(api.accessControl.submitTipForReview)
  const returnTipToDraft = useMutation(api.accessControl.returnTipToDraft)
  const publishTip = useMutation(api.accessControl.publishTip)
  const deprecateTip = useMutation(api.accessControl.deprecateTip)
  const configureIntegration = useMutation(api.accessControl.configureIntegration)
  const unsubscribeFromComponentWatchlist = useMutation(
    api.accessControl.unsubscribeFromComponentWatchlist,
  )
  const markWatchNotificationRead = useMutation(
    api.accessControl.markWatchNotificationRead,
  )
  const markAllWatchNotificationsRead = useMutation(
    api.accessControl.markAllWatchNotificationsRead,
  )

  const user = auth.user
  const organizationId = auth.organizationId ?? undefined

  const accessProfile = useQuery(
    api.accessControl.getAccessProfile,
    user
      ? {
          workosUserId: user.id,
          organizationId,
        }
      : 'skip',
  )

  const role = accessProfile?.role ?? 'Reader'
  const canCreateTips = accessProfile
    ? hasPermission(accessProfile.role, 'tips.create')
    : false
  const canReadTips = accessProfile
    ? hasPermission(accessProfile.role, 'tips.read')
    : false
  const canReadAudit = accessProfile
    ? hasPermission(accessProfile.role, 'audit.read')
    : false

  const auditEvents = useQuery(
    api.accessControl.listAuditEvents,
    user && canReadAudit
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 12,
        }
      : 'skip',
  )

  const tips = useQuery(
    api.accessControl.listTips,
    user && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 120,
        }
      : 'skip',
  )

  const tipSearchError = validateTipSearchState(tipSearchState)

  const filteredTips = useQuery(
    api.accessControl.listTips,
    user && canReadTips && !tipSearchError
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          searchText: tipSearchState.searchText,
          project: tipSearchState.project,
          library: tipSearchState.library,
          component: tipSearchState.component,
          tag: tipSearchState.tag,
          status:
            tipSearchState.status === 'all'
              ? undefined
              : tipSearchState.status,
          limit: 60,
        }
      : 'skip',
  )

  const editorTip = useQuery(
    api.accessControl.getTipForEditor,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
        }
      : 'skip',
  )

  const tipRevisions = useQuery(
    api.accessControl.listTipRevisions,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
          limit: 10,
        }
      : 'skip',
  )

  const editorTipComponentLinks = useQuery(
    api.accessControl.listTipComponentLinksForEditor,
    user && draftTipId && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          tipId: draftTipId,
        }
      : 'skip',
  )

  const componentWorkspaces = useQuery(
    api.accessControl.listComponentExplorerWorkspaces,
    user && canCreateTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 20,
        }
      : 'skip',
  )

  const selectedWorkspaceGraph = useQuery(
    api.accessControl.getComponentExplorerWorkspace,
    user && canCreateTips && linkWorkspaceId
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId: linkWorkspaceId,
        }
      : 'skip',
  )

  const selectedProjectGraph = useQuery(
    api.accessControl.getComponentExplorerProject,
    user && canCreateTips && linkWorkspaceId && linkProjectName
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          workspaceId: linkWorkspaceId,
          projectName: linkProjectName,
        }
      : 'skip',
  )

  const myWatchSubscriptions = useQuery(
    api.accessControl.listMyComponentWatchSubscriptions,
    user && canReadTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          limit: 60,
        }
      : 'skip',
  )

  const watchNotifications = useQuery(
    api.accessControl.listWatchNotifications,
    user && canReadTips
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
          unreadOnly: showUnreadNotificationsOnly,
          limit: 60,
        }
      : 'skip',
  )

  const selectedTipStatus =
    editorTip?.status ?? tips?.find((tip) => tip.id === draftTipId)?.status ?? null

  const can = (permission: Permission) =>
    accessProfile ? hasPermission(role, permission) : false

  const runAction = async (
    successMessage: string,
    action: () => Promise<void>,
  ) => {
    try {
      await action()
      setStatusMessage(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setStatusMessage(`Action failed: ${message}`)
    }
  }

  const addSelectedComponentLink = () => {
    if (!selectedProjectGraph || !linkComponentId) {
      setTipComponentMessage(
        'Select a workspace, project, and component before adding a link.',
      )
      return
    }

    const component = selectedProjectGraph.components.find(
      (entry) => entry.id === linkComponentId,
    )

    if (!component) {
      setTipComponentMessage('Selected component was not found in this project.')
      return
    }

    const nextLink: TipComponentLink = {
      workspaceId: linkWorkspaceId,
      projectName: selectedProjectGraph.project.name,
      componentName: component.name,
      componentFilePath: component.filePath,
    }

    const nextKey = getTipComponentLinkKey(nextLink)
    const hasDuplicate = tipComponentLinks.some(
      (link) => getTipComponentLinkKey(link) === nextKey,
    )

    if (hasDuplicate) {
      setTipComponentMessage('This component is already linked to the draft.')
      return
    }

    setTipComponentLinks((current) => [...current, nextLink])
    setTipComponentMessage('Component link added.')
  }

  const removeComponentLink = (linkToRemove: TipComponentLink) => {
    const removeKey = getTipComponentLinkKey(linkToRemove)
    setTipComponentLinks((current) =>
      current.filter((link) => getTipComponentLinkKey(link) !== removeKey),
    )
    setTipComponentMessage('Component link removed.')
  }

  const removeWatchSubscription = async (link: TipComponentLink) => {
    if (!user) {
      return
    }

    try {
      const result = await unsubscribeFromComponentWatchlist({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        workspaceId: link.workspaceId,
        projectName: link.projectName,
        componentName: link.componentName,
        componentFilePath: link.componentFilePath,
      })

      if (result.removedCount === 0) {
        setWatchlistMessage('No matching watchlist subscription was found.')
        return
      }

      setWatchlistMessage(
        `Watchlist subscription removed (${String(result.removedCount)} record${result.removedCount === 1 ? '' : 's'}).`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setWatchlistMessage(`Failed to remove watchlist subscription: ${message}`)
    }
  }

  const markNotificationAsRead = async (notificationId: Id<'watchNotifications'>) => {
    if (!user) {
      return
    }

    try {
      const result = await markWatchNotificationRead({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        notificationId,
      })

      setNotificationMessage(
        result.updated
          ? 'Notification marked as read.'
          : 'Notification was already marked as read.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setNotificationMessage(`Failed to mark notification as read: ${message}`)
    }
  }

  const markAllNotificationsAsRead = async () => {
    if (!user) {
      return
    }

    try {
      const result = await markAllWatchNotificationsRead({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        limit: 120,
      })

      setNotificationMessage(
        `Marked ${String(result.updatedCount)} notification${result.updatedCount === 1 ? '' : 's'} as read.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setNotificationMessage(`Failed to mark notifications: ${message}`)
    }
  }

  const setEditorField = (
    field: keyof TipEditorFormState,
    value: string,
  ) => {
    setTipEditorState((current) => ({
      ...current,
      [field]: value,
    }))

    setTipValidationErrors((current) => {
      if (!current[field]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const setTipSearchField = <K extends keyof TipSearchState>(
    field: K,
    value: TipSearchState[K],
  ) => {
    setTipSearchState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const resetEditorToNewDraft = () => {
    setDraftTipId(null)
    setTipEditorState(createEmptyTipEditorState())
    setTipValidationErrors({})
    setTipEditorMessage(null)
    setTipComponentLinks([])
    setTipComponentMessage(null)
    setLinkWorkspaceId('')
    setLinkProjectName('')
    setLinkComponentId('')
  }

  const selectDraftTip = (nextTipId: string) => {
    setTipEditorMessage(null)
    setTipComponentMessage(null)

    if (!nextTipId) {
      resetEditorToNewDraft()
      return
    }

    setDraftTipId(nextTipId as Id<'tips'>)
    setTipValidationErrors({})
    setTipComponentLinks([])
  }

  const loadSelectedTipContent = () => {
    if (!editorTip) {
      setTipEditorMessage('Tip content is still loading.')
      return
    }

    setTipEditorState({
      symptom: editorTip.symptom,
      rootCause: editorTip.rootCause,
      fix: editorTip.fix,
      prevention: editorTip.prevention,
      project: editorTip.project ?? '',
      library: editorTip.library ?? '',
      component: editorTip.component ?? '',
      tags: editorTip.tags.join(', '),
      references: editorTip.references.join('\n'),
    })

    if (editorTipComponentLinks) {
      setTipComponentLinks(
        editorTipComponentLinks.map((link) => ({
          workspaceId: link.workspaceId,
          projectName: link.projectName,
          componentName: link.componentName,
          componentFilePath: link.componentFilePath,
        })),
      )
      setTipComponentMessage(
        `Loaded ${String(editorTipComponentLinks.length)} linked component${editorTipComponentLinks.length === 1 ? '' : 's'}.`,
      )
    } else {
      setTipComponentMessage(
        'Tip content loaded. Component links are still loading.',
      )
    }

    setTipValidationErrors({})
    setTipEditorMessage('Loaded selected tip content into the editor.')
  }

  const saveEditorDraft = async () => {
    if (!user) {
      return
    }

    const { payload, errors } = buildTipDraftPayload(tipEditorState)
    if (!payload) {
      setTipValidationErrors(errors)
      setTipEditorMessage('Fix validation errors before saving.')
      return
    }

    try {
      const result = await saveTipDraft({
        actorWorkosUserId: user.id,
        actorOrganizationId: organizationId,
        tipId: draftTipId ?? undefined,
        ...payload,
        componentLinks: tipComponentLinks,
      })

      setDraftTipId(result.tipId)
      setTipValidationErrors({})
      setTipEditorMessage(
        `Draft saved as revision ${result.revisionNumber} at ${new Date(result.updatedAt).toLocaleString()} with ${String(tipComponentLinks.length)} linked component${tipComponentLinks.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTipEditorMessage(`Draft save failed: ${message}`)
    }
  }

  const setActiveTab = (tab: DashboardTab) => {
    void navigate({
      search: { tab },
    })
  }

  const sidebar = (
    <SidebarRail
      brandMeta="Governance + prevention tips"
      brandTitle="Engineering Insights"
      footer={
        <div className="space-y-2 text-sm text-slate-300">
          <p>
            Signed in as <code className="app-code">{role}</code>
          </p>
          <Link className="app-btn-secondary w-full justify-start" to="/logout">
            Sign out
          </Link>
        </div>
      }
      navLabel="Dashboard sections"
      navSlot={
        <>
          {dashboardTabs.map((tab) => (
            <button
              key={tab.value}
              className={cn(
                'app-btn-secondary w-full justify-start',
                activeTab === tab.value &&
                  'border-cyan-300/45 bg-cyan-300/20 text-cyan-100',
              )}
              onClick={() => setActiveTab(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
          <div className="h-px bg-white/10" />
          <Link className="app-btn-secondary w-full justify-start" to="/explorer">
            Component explorer
          </Link>
          <Link className="app-btn-secondary w-full justify-start" to="/">
            Home
          </Link>
        </>
      }
    />
  )

  if (auth.loading || !user || !accessProfile) {
    return (
      <AppShell
        topbar={
          <PageTopbar
            description="Loading role-aware access profile and dashboard context."
            title="Authenticated Dashboard"
          />
        }
      >
        <div className="app-panel">
          <p className="text-sm text-slate-300">Please wait while we load your profile.</p>
        </div>
      </AppShell>
    )
  }

  const tabContent: Record<DashboardTab, ReactNode> = {
    overview: (
      <OverviewPanel
        canCreateTips={canCreateTips}
        canReadAudit={canReadAudit}
        canReadTips={canReadTips}
        organizationId={organizationId}
        role={role}
        userId={user.id}
        watchSubscriptionCount={myWatchSubscriptions?.length ?? 0}
      />
    ),
    'tip-studio': (
      <TipStudioPanel
        canCreateTips={canCreateTips}
        canLoadSelectedTip={Boolean(draftTipId && editorTip)}
        componentWorkspaces={componentWorkspaces}
        draftTipId={draftTipId}
        editorTip={editorTip}
        editorTipComponentLinks={editorTipComponentLinks}
        linkComponentId={linkComponentId}
        linkProjectName={linkProjectName}
        linkWorkspaceId={linkWorkspaceId}
        onAddSelectedComponentLink={addSelectedComponentLink}
        onLoadSelectedTipContent={loadSelectedTipContent}
        onRemoveComponentLink={removeComponentLink}
        onResetToNewDraft={resetEditorToNewDraft}
        onSaveDraft={saveEditorDraft}
        onSelectDraftTip={selectDraftTip}
        onSetEditorField={setEditorField}
        onSetLinkComponentId={(value) => {
          setLinkComponentId(value)
          setTipComponentMessage(null)
        }}
        onSetLinkProjectName={(value) => {
          setLinkProjectName(value)
          setLinkComponentId('')
          setTipComponentMessage(null)
        }}
        onSetLinkWorkspaceId={(value) => {
          setLinkWorkspaceId(value)
          setLinkProjectName('')
          setLinkComponentId('')
          setTipComponentMessage(null)
        }}
        selectedProjectGraph={selectedProjectGraph}
        selectedWorkspaceGraph={selectedWorkspaceGraph}
        tipComponentLinks={tipComponentLinks}
        tipComponentMessage={tipComponentMessage}
        tipEditorMessage={tipEditorMessage}
        tipEditorState={tipEditorState}
        tipRevisions={tipRevisions}
        tipValidationErrors={tipValidationErrors}
        tips={
          tips?.map((tip) => ({
            id: tip.id,
            title: tip.title,
            status: tip.status,
            currentRevision: tip.currentRevision,
          })) ?? []
        }
        workspaceToRouteParam={encodeWorkspaceRouteParam}
      />
    ),
    workflow: (
      <WorkflowPanel
        canAssignRoles={can('roles.assign')}
        canConfigureIntegration={can('integration.configure')}
        canCreateTips={canCreateTips}
        canDeprecateTips={can('tips.deprecate')}
        canPublishTips={can('tips.publish')}
        draftTipId={draftTipId}
        nextRole={nextRole}
        onAssignRole={() =>
          void runAction('Role assignment saved and audited.', async () => {
            await assignRole({
              actorWorkosUserId: user.id,
              actorOrganizationId: organizationId,
              targetWorkosUserId,
              role: nextRole,
            })
          })
        }
        onBootstrapFirstAdmin={() =>
          void runAction('Bootstrap completed: current user is now Admin.', async () => {
            await bootstrapFirstAdmin({
              actorWorkosUserId: user.id,
              actorOrganizationId: organizationId,
            })
          })
        }
        onConfigureIntegration={() =>
          void runAction(
            'Integration config updated and audit event stored.',
            async () => {
              await configureIntegration({
                actorWorkosUserId: user.id,
                actorOrganizationId: organizationId,
                key: 'azure-devops',
                enabled: true,
              })
            },
          )
        }
        onDeprecateTip={() =>
          void runAction('Tip deprecated and audit event stored.', async () => {
            if (!draftTipId) {
              throw new Error('Select a tip first.')
            }

            await deprecateTip({
              actorWorkosUserId: user.id,
              actorOrganizationId: organizationId,
              tipId: draftTipId,
            })
          })
        }
        onPublishTip={() =>
          void (async () => {
            if (!draftTipId) {
              setStatusMessage('Action failed: Select a tip first.')
              return
            }

            try {
              const result = await publishTip({
                actorWorkosUserId: user.id,
                actorOrganizationId: organizationId,
                tipId: draftTipId,
              })

              setStatusMessage(
                `Tip published and audited. ${String(result.notificationCount)} ${result.notificationEventType} notification${result.notificationCount === 1 ? '' : 's'} logged.`,
              )
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unknown error'
              setStatusMessage(`Action failed: ${message}`)
            }
          })()
        }
        onReturnTipToDraft={() =>
          void runAction('Tip returned to draft for edits.', async () => {
            if (!draftTipId) {
              throw new Error('Select a tip first.')
            }

            await returnTipToDraft({
              actorWorkosUserId: user.id,
              actorOrganizationId: organizationId,
              tipId: draftTipId,
            })
          })
        }
        onSetNextRole={setNextRole}
        onSetTargetWorkosUserId={setTargetWorkosUserId}
        onSubmitForReview={() =>
          void runAction('Tip moved to in_review.', async () => {
            if (!draftTipId) {
              throw new Error('Save a draft tip first.')
            }

            await submitTipForReview({
              actorWorkosUserId: user.id,
              actorOrganizationId: organizationId,
              tipId: draftTipId,
            })
          })
        }
        selectedTipStatus={selectedTipStatus}
        statusMessage={statusMessage}
        targetWorkosUserId={targetWorkosUserId}
      />
    ),
    search: (
      <SearchPanel
        canReadTips={canReadTips}
        onClearFilters={() => setTipSearchState(createEmptyTipSearchState())}
        onSetTipSearchField={setTipSearchField}
        results={filteredTips}
        searchError={tipSearchError}
        tipSearchState={tipSearchState}
      />
    ),
    watchlist: (
      <WatchlistPanel
        canReadTips={canReadTips}
        encodeWorkspaceId={encodeWorkspaceRouteParam}
        notificationMessage={notificationMessage}
        notifications={watchNotifications}
        onMarkAllNotificationsAsRead={() => void markAllNotificationsAsRead()}
        onMarkNotificationAsRead={(id) =>
          void markNotificationAsRead(id as Id<'watchNotifications'>)
        }
        onRemoveWatchSubscription={(link) => void removeWatchSubscription(link)}
        onSetShowUnreadOnly={setShowUnreadNotificationsOnly}
        showUnreadOnly={showUnreadNotificationsOnly}
        subscriptions={myWatchSubscriptions}
        watchlistMessage={watchlistMessage}
      />
    ),
    audit: <AuditPanel canReadAudit={canReadAudit} events={auditEvents} />,
  }

  return (
    <AppShell
      mobileRail={sidebar}
      sidebar={sidebar}
      topbar={
        <PageTopbar
          actions={
            <>
              <Link className="app-btn-secondary" to="/explorer">
                Component explorer
              </Link>
              <Link className="app-btn-secondary" to="/">
                Home
              </Link>
            </>
          }
          description="Access is protected by WorkOS session checks plus capability guards mapped from your current role."
          title="Engineering Insights Dashboard"
        />
      }
    >
      <DashboardTabs onChange={setActiveTab} value={activeTab} />
      {tabContent[activeTab]}
    </AppShell>
  )
}
