import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import {
  activeConvexDeployment,
  vercelConfig,
  workosClientConfig,
} from '../config/platform'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})

function HomePage() {
  const health = useQuery(api.health.getStatus)

  return (
    <main>
      <h1>BetterDoc Foundation</h1>
      <p>
        TanStack Start is scaffolded and connected to Convex. This page exercises a
        typed query reference via <code>api.health.getStatus</code>.
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
      </section>

      <section>
        <h2>Convex Health Query</h2>
        <p>Status: {health?.status ?? 'loading'}</p>
        <p>Backend deployment: {health?.deployment ?? 'pending'}</p>
      </section>
    </main>
  )
}
