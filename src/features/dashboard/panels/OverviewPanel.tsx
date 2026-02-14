import { Link } from '@tanstack/react-router'

import { MetricStrip } from '@/components/ui/MetricStrip'
import { Panel } from '@/components/ui/Panel'
import { StatusChip } from '@/components/ui/StatusChip'

type OverviewPanelProps = {
  canCreateTips: boolean
  canReadAudit: boolean
  canReadTips: boolean
  organizationId?: string
  role: string
  userId: string
  watchSubscriptionCount: number
}

export function OverviewPanel({
  canCreateTips,
  canReadAudit,
  canReadTips,
  organizationId,
  role,
  userId,
  watchSubscriptionCount,
}: OverviewPanelProps) {
  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          {
            label: 'Session Role',
            value: role,
            hint: canReadAudit ? 'Reviewer privileges active' : 'Read-only audit access',
            tone: canReadAudit ? 'success' : 'info',
          },
          {
            label: 'Tip Authoring',
            value: canCreateTips ? 'Enabled' : 'Locked',
            hint: canCreateTips ? 'Can create and edit drafts' : 'Requires Contributor',
            tone: canCreateTips ? 'success' : 'warning',
          },
          {
            label: 'Tip Discovery',
            value: canReadTips ? 'Enabled' : 'Locked',
            hint: canReadTips ? 'Search index available' : 'Requires Reader+',
            tone: canReadTips ? 'info' : 'warning',
          },
          {
            label: 'Watchlist',
            value: watchSubscriptionCount,
            hint: 'Active subscriptions',
            tone: 'default',
          },
        ]}
      />

      <Panel
        description="Access is enforced by WorkOS sessions and server-side capability checks in Convex."
        title="Session and Access"
      >
        <dl className="grid gap-3 md:grid-cols-3">
          <div className="app-card py-3">
            <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">WorkOS user</dt>
            <dd className="mt-1 font-mono text-sm text-cyan-100">{userId}</dd>
          </div>
          <div className="app-card py-3">
            <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Active role</dt>
            <dd className="mt-1">
              <StatusChip tone="info">{role}</StatusChip>
            </dd>
          </div>
          <div className="app-card py-3">
            <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Organization</dt>
            <dd className="mt-1 font-mono text-sm text-slate-100">{organizationId ?? 'none'}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        description="Capability progression used by API guards and UI gates."
        title="RBAC Matrix"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm text-slate-200">
            <thead>
              <tr className="text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="pb-3">Role</th>
                <th className="pb-3">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td className="py-3 font-semibold text-white">Reader</td>
                <td className="py-3">
                  <code className="app-code">tips.read</code>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-white">Contributor</td>
                <td className="py-3">
                  <code className="app-code">tips.read</code>{' '}
                  <code className="app-code">tips.create</code>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-white">Reviewer</td>
                <td className="py-3">
                  <code className="app-code">tips.publish</code>{' '}
                  <code className="app-code">tips.deprecate</code>{' '}
                  <code className="app-code">audit.read</code>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-white">Admin</td>
                <td className="py-3">
                  <code className="app-code">roles.assign</code>{' '}
                  <code className="app-code">integration.configure</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Quick Navigation">
        <div className="flex flex-wrap gap-2">
          <Link className="app-btn-secondary" to="/explorer">
            Open explorer
          </Link>
          <Link className="app-btn-secondary" to="/">
            Home
          </Link>
          <Link className="app-btn-secondary" to="/logout">
            Sign out
          </Link>
        </div>
      </Panel>
    </div>
  )
}
