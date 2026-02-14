import { Panel } from '@/components/ui/Panel'

type WorkflowPanelProps = {
  canConfigureIntegration: boolean
  canCreateTips: boolean
  canDeprecateTips: boolean
  canPublishTips: boolean
  canAssignRoles: boolean
  draftTipId: string | null
  nextRole: 'Reader' | 'Contributor' | 'Reviewer' | 'Admin'
  onAssignRole: () => void
  onBootstrapFirstAdmin: () => void
  onConfigureIntegration: () => void
  onDeprecateTip: () => void
  onPublishTip: () => void
  onReturnTipToDraft: () => void
  onSetNextRole: (value: 'Reader' | 'Contributor' | 'Reviewer' | 'Admin') => void
  onSetTargetWorkosUserId: (value: string) => void
  onSubmitForReview: () => void
  selectedTipStatus: string | null
  statusMessage: string | null
  targetWorkosUserId: string
}

export function WorkflowPanel({
  canAssignRoles,
  canConfigureIntegration,
  canCreateTips,
  canDeprecateTips,
  canPublishTips,
  draftTipId,
  nextRole,
  onAssignRole,
  onBootstrapFirstAdmin,
  onConfigureIntegration,
  onDeprecateTip,
  onPublishTip,
  onReturnTipToDraft,
  onSetNextRole,
  onSetTargetWorkosUserId,
  onSubmitForReview,
  selectedTipStatus,
  statusMessage,
  targetWorkosUserId,
}: WorkflowPanelProps) {
  return (
    <div className="space-y-4">
      <Panel
        description="Promote draft tips through review and publish stages with role-based gates."
        title="Tip Workflow"
      >
        {!canCreateTips ? (
          <p className="text-sm text-amber-200">Permission denied. tips.create is required.</p>
        ) : (
          <div className="space-y-4">
            {!draftTipId ? (
              <p className="text-sm text-slate-300">Select or create a tip in Tip Studio first.</p>
            ) : (
              <p className="text-sm text-slate-200">
                Selected tip status: <code className="app-code">{selectedTipStatus ?? 'loading'}</code>
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                className="app-btn"
                disabled={!draftTipId || selectedTipStatus !== 'draft'}
                onClick={onSubmitForReview}
                type="button"
              >
                Submit for review
              </button>
              <button
                className="app-btn-secondary"
                disabled={!canPublishTips || !draftTipId || selectedTipStatus !== 'in_review'}
                onClick={onReturnTipToDraft}
                type="button"
              >
                Return to draft
              </button>
              <button
                className="app-btn"
                disabled={!canPublishTips || !draftTipId || selectedTipStatus !== 'in_review'}
                onClick={onPublishTip}
                type="button"
              >
                Publish tip
              </button>
              <button
                className="app-btn-danger"
                disabled={!canDeprecateTips || !draftTipId || selectedTipStatus !== 'published'}
                onClick={onDeprecateTip}
                type="button"
              >
                Deprecate tip
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        description="One-time and admin-level operations stay server-guarded and audited."
        title="Privileged Actions"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="app-card space-y-3">
            <h3 className="font-display text-lg font-semibold text-white">Admin bootstrap and role assignment</h3>
            <button className="app-btn-secondary" onClick={onBootstrapFirstAdmin} type="button">
              Bootstrap first admin
            </button>
            <label className="app-label" htmlFor="target-user-id">
              Target user ID
            </label>
            <input
              className="app-input"
              id="target-user-id"
              onChange={(event) => onSetTargetWorkosUserId(event.target.value)}
              placeholder="user_123"
              value={targetWorkosUserId}
            />
            <label className="app-label" htmlFor="next-role">
              Next role
            </label>
            <select
              className="app-select"
              id="next-role"
              onChange={(event) =>
                onSetNextRole(event.target.value as 'Reader' | 'Contributor' | 'Reviewer' | 'Admin')
              }
              value={nextRole}
            >
              <option value="Reader">Reader</option>
              <option value="Contributor">Contributor</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Admin">Admin</option>
            </select>
            <button
              className="app-btn"
              disabled={!canAssignRoles || targetWorkosUserId.length === 0}
              onClick={onAssignRole}
              type="button"
            >
              Assign role
            </button>
          </div>

          <div className="app-card space-y-3">
            <h3 className="font-display text-lg font-semibold text-white">Integration control</h3>
            <p className="text-sm text-slate-300">
              Integration mutations remain backend-authorized and produce audit events.
            </p>
            <button
              className="app-btn-secondary"
              disabled={!canConfigureIntegration}
              onClick={onConfigureIntegration}
              type="button"
            >
              Configure integration
            </button>
          </div>
        </div>

        {statusMessage ? <p className="mt-4 text-sm text-cyan-100">{statusMessage}</p> : null}
      </Panel>
    </div>
  )
}
