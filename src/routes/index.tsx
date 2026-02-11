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
    <main>
      <h1>BetterDoc</h1>
      <p>
        TanStack Start, Convex, and WorkOS AuthKit are wired. Use this page to
        start sign-in and verify auth-protected routes.
      </p>

      <section>
        <h2>Environment</h2>
        <p>
          Active env deploy target: <code>{activeConvexDeployment}</code>
        </p>
        <p>
          Vercel env: <code>{vercelConfig.environment ?? 'unset'}</code>
        </p>
      </section>

      <section>
        <h2>WorkOS Config Point</h2>
        <p>
          Client ID: <code>{workosClientConfig.clientId}</code>
        </p>
        <p>
          Redirect URI: <code>{workosClientConfig.redirectUri}</code>
        </p>
        <p>
          <a href="/login">Sign in with WorkOS</a>
        </p>
        <p>
          <a href="/dashboard">Go to protected dashboard</a>
        </p>
        <p>
          <a href="/logout">Sign out</a>
        </p>
      </section>

      <section>
        <h2>Convex Health Query</h2>
        <p>Status: {health?.status ?? 'loading'}</p>
        <p>Backend deployment: {health?.deployment ?? 'pending'}</p>
      </section>
    </main>
  )
}
