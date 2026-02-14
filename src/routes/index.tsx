import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { MetricStrip } from '@/components/ui/MetricStrip'
import { AppShell } from '@/components/ui/AppShell'
import { PageTopbar } from '@/components/ui/PageTopbar'
import { Panel } from '@/components/ui/Panel'
import { StatusChip } from '@/components/ui/StatusChip'
import { api } from '../../convex/_generated/api.js'
import {
  activeConvexDeployment,
  vercelConfig,
  workosClientConfig,
} from '../config/platform'

export const Route = createFileRoute('/')({
  ssr: false,
  loader: async () => {
    return null
  },
  component: HomePage,
})

function HomePage() {
  const health = useQuery(api.health.getStatus)
  const healthTone = health?.status === 'ok' ? 'success' : health?.status ? 'warning' : 'info'

  return (
    <AppShell
      topbar={
        <PageTopbar
          actions={
            <>
              <Link className="app-btn" search={{ tab: 'overview' }} to="/dashboard">
                Open dashboard
              </Link>
              <Link className="app-btn-secondary" to="/explorer">
                Open explorer
              </Link>
            </>
          }
          description="Operational command surface for authentication, role-aware workflows, and component intelligence."
          eyebrow="Control center"
          title="BetterDoc"
        />
      }
    >
      <MetricStrip
        items={[
          {
            label: 'Convex Deployment',
            value: <code className="app-code">{activeConvexDeployment}</code>,
            hint: 'Runtime target',
            tone: 'info',
          },
          {
            label: 'Vercel Environment',
            value: vercelConfig.environment ?? 'unset',
            hint: 'Build context',
            tone: 'default',
          },
          {
            label: 'Health Status',
            value: health?.status ?? 'loading',
            hint: health?.deployment ?? 'pending',
            tone: healthTone,
          },
          {
            label: 'Auth Redirect',
            value: 'WorkOS',
            hint: 'Client configured',
            tone: 'info',
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel
          description="Current client/runtime bindings used by TanStack Start + WorkOS middleware."
          title="Environment"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="app-card py-3">
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">Client ID</dt>
              <dd className="mt-1">
                <code className="app-code">{workosClientConfig.clientId}</code>
              </dd>
            </div>
            <div className="app-card py-3">
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">Redirect URI</dt>
              <dd className="mt-1 break-all">
                <code className="app-code">{workosClientConfig.redirectUri}</code>
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          description="Launch authenticated and explorer surfaces from one place."
          title="Quick Actions"
        >
          <div className="grid gap-2">
            <Link className="app-btn" to="/login">
              Sign in with WorkOS
            </Link>
            <Link className="app-btn-secondary" search={{ tab: 'overview' }} to="/dashboard">
              Go to protected dashboard
            </Link>
            <Link className="app-btn-secondary" to="/explorer">
              Open component explorer
            </Link>
            <Link className="app-btn-danger" to="/logout">
              Sign out
            </Link>
          </div>
        </Panel>
      </div>

      <Panel description="Live backend health from Convex query endpoint." title="Runtime Health">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip tone={healthTone}>Status: {health?.status ?? 'loading'}</StatusChip>
          <span className="text-sm text-slate-300">
            Backend deployment: {health?.deployment ?? 'pending'}
          </span>
        </div>
      </Panel>
    </AppShell>
  )
}
