import { Link, createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import { hasPermission, type AppRole, type Permission } from '../lib/rbac'

export const Route = createFileRoute('/dashboard')({
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [draftTipId, setDraftTipId] = useState<Id<'tips'> | null>(null)
  const [targetWorkosUserId, setTargetWorkosUserId] = useState('')
  const [nextRole, setNextRole] = useState<AppRole>('Reader')

  const bootstrapFirstAdmin = useMutation(api.accessControl.bootstrapFirstAdmin)
  const assignRole = useMutation(api.accessControl.assignRole)
  const createTipDraft = useMutation(api.accessControl.createTipDraft)
  const publishTip = useMutation(api.accessControl.publishTip)
  const deprecateTip = useMutation(api.accessControl.deprecateTip)
  const configureIntegration = useMutation(api.accessControl.configureIntegration)

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
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
        }
      : 'skip',
  )

  const role = accessProfile?.role ?? 'Reader'
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

  if (auth.loading || !user || !accessProfile) {
    return (
      <main>
        <h1>Authenticated Dashboard</h1>
        <p>Loading role-aware access profile...</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Authenticated Dashboard</h1>
      <p>
        Access is protected by WorkOS session checks plus capability guards
        mapped from the signed-in user role.
      </p>

      <section>
        <h2>Session + Role</h2>
        <p>
          WorkOS user: <code>{user.id}</code>
        </p>
        <p>
          Active role: <code>{role}</code>
        </p>
        <p>
          Organization: <code>{organizationId ?? 'none'}</code>
        </p>
      </section>

      <section>
        <h2>RBAC Matrix</h2>
        <p>
          Reader: <code>tips.read</code>
        </p>
        <p>
          Contributor: <code>tips.read</code>, <code>tips.create</code>
        </p>
        <p>
          Reviewer: Contributor + <code>tips.publish</code>,{' '}
          <code>tips.deprecate</code>, <code>audit.read</code>
        </p>
        <p>
          Admin: Reviewer + <code>roles.assign</code>,{' '}
          <code>integration.configure</code>
        </p>
      </section>

      <section>
        <h2>Privileged Actions (Guarded)</h2>
        <p>
          <button
            type="button"
            onClick={() =>
              runAction('Bootstrap completed: current user is now Admin.', async () => {
                await bootstrapFirstAdmin({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                })
              })
            }
          >
            Bootstrap first admin (one-time)
          </button>
        </p>

        <p>
          <button
            type="button"
            disabled={!can('tips.create')}
            onClick={() =>
              runAction('Draft tip saved.', async () => {
                const draft = await createTipDraft({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                  slug: 'bd-004-rbac-demo-tip',
                  title: 'RBAC guarded workflow demo',
                })
                setDraftTipId(draft.tipId)
              })
            }
          >
            Create draft tip (Contributor+)
          </button>
        </p>

        <p>
          <button
            type="button"
            disabled={!can('tips.publish') || !draftTipId}
            onClick={() =>
              runAction('Tip published and audit event stored.', async () => {
                if (!draftTipId) {
                  throw new Error('Create a draft tip first.')
                }

                await publishTip({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                  tipId: draftTipId,
                })
              })
            }
          >
            Publish tip (Reviewer+)
          </button>
        </p>

        <p>
          <button
            type="button"
            disabled={!can('tips.deprecate') || !draftTipId}
            onClick={() =>
              runAction('Tip deprecated and audit event stored.', async () => {
                if (!draftTipId) {
                  throw new Error('Create a draft tip first.')
                }

                await deprecateTip({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                  tipId: draftTipId,
                })
              })
            }
          >
            Deprecate tip (Reviewer+)
          </button>
        </p>

        <p>
          <label htmlFor="target-user-id">Role assignment target user ID: </label>
          <input
            id="target-user-id"
            value={targetWorkosUserId}
            onChange={(event) => setTargetWorkosUserId(event.target.value)}
            placeholder="user_123"
          />
        </p>
        <p>
          <label htmlFor="next-role">Next role: </label>
          <select
            id="next-role"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value as AppRole)}
          >
            <option value="Reader">Reader</option>
            <option value="Contributor">Contributor</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Admin">Admin</option>
          </select>
        </p>
        <p>
          <button
            type="button"
            disabled={!can('roles.assign') || targetWorkosUserId.length === 0}
            onClick={() =>
              runAction('Role assignment saved and audited.', async () => {
                await assignRole({
                  actorWorkosUserId: user.id,
                  actorOrganizationId: organizationId,
                  targetWorkosUserId,
                  role: nextRole,
                })
              })
            }
          >
            Assign role (Admin)
          </button>
        </p>

        <p>
          <button
            type="button"
            disabled={!can('integration.configure')}
            onClick={() =>
              runAction(
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
          >
            Configure integration (Admin)
          </button>
        </p>

        {draftTipId && (
          <p>
            Current draft tip ID: <code>{draftTipId}</code>
          </p>
        )}
        {statusMessage && <p>{statusMessage}</p>}
      </section>

      <section>
        <h2>Audit Events</h2>
        {!canReadAudit && (
          <p>
            Permission denied. <code>audit.read</code> is required.
          </p>
        )}
        {canReadAudit && auditEvents?.length === 0 && (
          <p>No audit events yet for this tenant.</p>
        )}
        {canReadAudit &&
          auditEvents?.map((event) => (
            <p key={event.id}>
              [{new Date(event.createdAt).toISOString()}] {event.action} by{' '}
              <code>{event.actorWorkosUserId}</code> on{' '}
              <code>
                {event.targetType}:{event.targetId}
              </code>
            </p>
          ))}
      </section>

      <section>
        <h2>Tips View (Query Guarded)</h2>
        {tips?.length === 0 && <p>No visible tips for the current role.</p>}
        {tips?.map((tip) => (
          <p key={tip.id}>
            <code>{tip.slug}</code> - {tip.title} ({tip.status})
          </p>
        ))}
      </section>

      <section>
        <h2>Navigation</h2>
        <p>
          <Link to="/logout">Sign out</Link>
        </p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  )
}
