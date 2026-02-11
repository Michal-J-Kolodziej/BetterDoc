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
  `[env] WorkOS redirect URI=${serverEnv.WORKOS_REDIRECT_URI}`,
)
console.log(`[env] WorkOS cookie same-site=${serverEnv.WORKOS_COOKIE_SAME_SITE ?? 'lax'}`)
console.log(`[env] WorkOS cookie name=${serverEnv.WORKOS_COOKIE_NAME ?? 'wos-session'}`)
console.log(
  `[env] Vercel environment=${serverEnv.VITE_VERCEL_ENV ?? 'unset'}`,
)
