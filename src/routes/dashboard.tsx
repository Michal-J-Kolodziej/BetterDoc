import { Link, createFileRoute } from '@tanstack/react-router'
import { getAuthkit } from '@workos/authkit-tanstack-react-start'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import { hasPermission, type AppRole, type Permission } from '../lib/rbac'
import {
  buildTipDraftPayload,
  createEmptyTipEditorState,
  type TipEditorFormState,
  type TipEditorValidationErrors,
} from '../lib/tip-editor'

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
  const [tipEditorMessage, setTipEditorMessage] = useState<string | null>(null)
  const [draftTipId, setDraftTipId] = useState<Id<'tips'> | null>(null)
  const [tipEditorState, setTipEditorState] = useState<TipEditorFormState>(
    createEmptyTipEditorState,
  )
  const [tipValidationErrors, setTipValidationErrors] =
    useState<TipEditorValidationErrors>({})
  const [targetWorkosUserId, setTargetWorkosUserId] = useState('')
  const [nextRole, setNextRole] = useState<AppRole>('Reader')

  const bootstrapFirstAdmin = useMutation(api.accessControl.bootstrapFirstAdmin)
  const assignRole = useMutation(api.accessControl.assignRole)
  const saveTipDraft = useMutation(api.accessControl.saveTipDraft)
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

  const role = accessProfile?.role ?? 'Reader'
  const canCreateTips = accessProfile
    ? hasPermission(accessProfile.role, 'tips.create')
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
    user
      ? {
          actorWorkosUserId: user.id,
          actorOrganizationId: organizationId,
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

  const resetEditorToNewDraft = () => {
    setDraftTipId(null)
    setTipEditorState(createEmptyTipEditorState())
    setTipValidationErrors({})
    setTipEditorMessage(null)
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
      })

      setDraftTipId(result.tipId)
      setTipValidationErrors({})
      setTipEditorMessage(
        `Draft saved as revision ${result.revisionNumber} at ${new Date(result.updatedAt).toLocaleString()}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTipEditorMessage(`Draft save failed: ${message}`)
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
        <h2>Tip Editor (BD-006, BD-007)</h2>
        {!canCreateTips && (
          <p>
            Permission denied. <code>tips.create</code> is required.
          </p>
        )}

        {canCreateTips && (
          <>
            <p>
              Structured fields are stored as tip revisions. Root cause, fix, and
              prevention support markdown text.
            </p>

            <p>
              <label htmlFor="tip-selector">Edit existing tip: </label>
              <select
                id="tip-selector"
                value={draftTipId ?? ''}
                onChange={(event) => {
                  const nextTipId = event.target.value
                  setTipEditorMessage(null)

                  if (!nextTipId) {
                    resetEditorToNewDraft()
                    return
                  }

                  setDraftTipId(nextTipId as Id<'tips'>)
                  setTipValidationErrors({})
                }}
              >
                <option value="">Create new draft</option>
                {tips?.map((tip) => (
                  <option key={tip.id} value={tip.id}>
                    {tip.title} ({tip.status}, r{tip.currentRevision})
                  </option>
                ))}
              </select>
            </p>

            {draftTipId && editorTip && (
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setTipEditorState({
                      symptom: editorTip.symptom,
                      rootCause: editorTip.rootCause,
                      fix: editorTip.fix,
                      prevention: editorTip.prevention,
                      tags: editorTip.tags.join(', '),
                      references: editorTip.references.join('\n'),
                    })
                    setTipValidationErrors({})
                    setTipEditorMessage('Loaded selected tip content into the editor.')
                  }}
                >
                  Load selected tip content
                </button>
              </p>
            )}

            <p>
              <label htmlFor="tip-symptom">Symptom</label>
              <br />
              <textarea
                id="tip-symptom"
                rows={3}
                value={tipEditorState.symptom}
                onChange={(event) =>
                  setEditorField('symptom', event.target.value)
                }
              />
              {tipValidationErrors.symptom && <br />}
              {tipValidationErrors.symptom && (
                <small>{tipValidationErrors.symptom}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-root-cause">Root cause</label>
              <br />
              <textarea
                id="tip-root-cause"
                rows={5}
                value={tipEditorState.rootCause}
                onChange={(event) =>
                  setEditorField('rootCause', event.target.value)
                }
              />
              {tipValidationErrors.rootCause && <br />}
              {tipValidationErrors.rootCause && (
                <small>{tipValidationErrors.rootCause}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-fix">Fix</label>
              <br />
              <textarea
                id="tip-fix"
                rows={5}
                value={tipEditorState.fix}
                onChange={(event) => setEditorField('fix', event.target.value)}
              />
              {tipValidationErrors.fix && <br />}
              {tipValidationErrors.fix && <small>{tipValidationErrors.fix}</small>}
            </p>

            <p>
              <label htmlFor="tip-prevention">Prevention</label>
              <br />
              <textarea
                id="tip-prevention"
                rows={5}
                value={tipEditorState.prevention}
                onChange={(event) =>
                  setEditorField('prevention', event.target.value)
                }
              />
              {tipValidationErrors.prevention && <br />}
              {tipValidationErrors.prevention && (
                <small>{tipValidationErrors.prevention}</small>
              )}
            </p>

            <p>
              <label htmlFor="tip-tags">Tags (comma or newline separated)</label>
              <br />
              <textarea
                id="tip-tags"
                rows={3}
                value={tipEditorState.tags}
                onChange={(event) => setEditorField('tags', event.target.value)}
              />
              {tipValidationErrors.tags && <br />}
              {tipValidationErrors.tags && <small>{tipValidationErrors.tags}</small>}
            </p>

            <p>
              <label htmlFor="tip-references">
                References (comma or newline separated)
              </label>
              <br />
              <textarea
                id="tip-references"
                rows={4}
                value={tipEditorState.references}
                onChange={(event) =>
                  setEditorField('references', event.target.value)
                }
              />
              {tipValidationErrors.references && <br />}
              {tipValidationErrors.references && (
                <small>{tipValidationErrors.references}</small>
              )}
            </p>

            <p>
              <button type="button" onClick={saveEditorDraft}>
                Save draft
              </button>{' '}
              <button type="button" onClick={resetEditorToNewDraft}>
                New draft
              </button>
            </p>

            {draftTipId && (
              <p>
                Current draft tip ID: <code>{draftTipId}</code>
              </p>
            )}
            {tipEditorMessage && <p>{tipEditorMessage}</p>}

            {draftTipId && (
              <>
                <h3>Revision history</h3>
                {tipRevisions?.length === 0 && <p>No revisions saved yet.</p>}
                {tipRevisions?.map((revision) => (
                  <p key={revision.revisionId}>
                    r{revision.revisionNumber} ({revision.status}) by{' '}
                    <code>{revision.editedByWorkosUserId}</code> at{' '}
                    {new Date(revision.createdAt).toISOString()}
                  </p>
                ))}
              </>
            )}
          </>
        )}
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
            disabled={!can('tips.publish') || !draftTipId}
            onClick={() =>
              runAction('Tip published and audit event stored.', async () => {
                if (!draftTipId) {
                  throw new Error('Save a draft tip first.')
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
                  throw new Error('Save a draft tip first.')
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
            <code>{tip.slug}</code> - {tip.title} ({tip.status}, r
            {tip.currentRevision})
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
