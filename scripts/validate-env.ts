import { serverEnv } from '../src/config/env.server'

const activeConvexDeploymentByEnvironment = {
  dev: serverEnv.VITE_CONVEX_DEPLOYMENT_DEV,
  staging: serverEnv.VITE_CONVEX_DEPLOYMENT_STAGING,
  prod: serverEnv.VITE_CONVEX_DEPLOYMENT_PROD,
}

const activeConvexDeployment =
  activeConvexDeploymentByEnvironment[serverEnv.VITE_APP_ENV]

console.log(`[env] VITE_APP_ENV=${serverEnv.VITE_APP_ENV}`)
console.log(`[env] Active Convex deployment=${activeConvexDeployment}`)
console.log(
  `[env] WorkOS redirect URI=${serverEnv.VITE_WORKOS_REDIRECT_URI}`,
)
console.log(
  `[env] Vercel environment=${serverEnv.VITE_VERCEL_ENV ?? 'unset'}`,
)
