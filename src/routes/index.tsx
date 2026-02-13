import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

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

  return (
    <main className="bd-home">
      <header className="bd-page-header">
        <div>
          <h1>BetterDoc Control Center</h1>
          <p>
            Operational entry point for auth, explorer workflows, and role-aware
            governance tools.
          </p>
        </div>
        <div className="bd-page-header-actions">
          <a href="/dashboard">Open dashboard</a>
          <a href="/explorer">Open explorer</a>
        </div>
      </header>

      <div className="bd-home-grid">
        <section className="bd-panel">
          <h2>Environment</h2>
          <p>
            Active env deploy target: <code>{activeConvexDeployment}</code>
          </p>
          <p>
            Vercel env: <code>{vercelConfig.environment ?? 'unset'}</code>
          </p>
        </section>

        <section className="bd-panel">
          <h2>WorkOS Config Point</h2>
          <p>
            Client ID: <code>{workosClientConfig.clientId}</code>
          </p>
          <p>
            Redirect URI: <code>{workosClientConfig.redirectUri}</code>
          </p>
          <div className="bd-link-stack">
            <a href="/login">Sign in with WorkOS</a>
            <a href="/dashboard">Go to protected dashboard</a>
            <a href="/explorer">Open component explorer</a>
            <a href="/logout">Sign out</a>
          </div>
        </section>

        <section className="bd-panel">
          <h2>Convex Health Query</h2>
          <p>Status: {health?.status ?? 'loading'}</p>
          <p>Backend deployment: {health?.deployment ?? 'pending'}</p>
        </section>
      </div>
    </main>
  )
}
