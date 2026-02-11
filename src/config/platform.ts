import { clientEnv } from './env.client'
import type { AppEnvironment } from './env.shared'

export const convexDeploymentByEnvironment: Record<AppEnvironment, string> = {
  dev: clientEnv.VITE_CONVEX_DEPLOYMENT_DEV,
  staging: clientEnv.VITE_CONVEX_DEPLOYMENT_STAGING,
  prod: clientEnv.VITE_CONVEX_DEPLOYMENT_PROD,
}

export const activeConvexDeployment =
  convexDeploymentByEnvironment[clientEnv.VITE_APP_ENV]

export const workosClientConfig = Object.freeze({
  clientId: clientEnv.VITE_WORKOS_CLIENT_ID,
  redirectUri: clientEnv.VITE_WORKOS_REDIRECT_URI,
})

export const vercelConfig = Object.freeze({
  environment: clientEnv.VITE_VERCEL_ENV ?? null,
  url: clientEnv.VITE_VERCEL_URL ?? null,
  productionUrl: clientEnv.VITE_VERCEL_PROJECT_PRODUCTION_URL ?? null,
})
