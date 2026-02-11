import type { PropsWithChildren } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

import { clientEnv } from '../config/env.client'

let convexClient: ConvexReactClient | null = null

function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    convexClient = new ConvexReactClient(clientEnv.VITE_CONVEX_URL)
  }

  return convexClient
}

export function ConvexAppProvider({ children }: PropsWithChildren) {
  if (typeof window === 'undefined') {
    return <>{children}</>
  }

  return <ConvexProvider client={getConvexClient()}>{children}</ConvexProvider>
}
