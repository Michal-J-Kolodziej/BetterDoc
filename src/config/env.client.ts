import { parsePublicEnvironment } from './env.shared'

const rawClientEnvironment: Record<string, unknown> = {
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CONVEX_DEPLOYMENT_DEV: import.meta.env.VITE_CONVEX_DEPLOYMENT_DEV,
  VITE_CONVEX_DEPLOYMENT_STAGING: import.meta.env.VITE_CONVEX_DEPLOYMENT_STAGING,
  VITE_CONVEX_DEPLOYMENT_PROD: import.meta.env.VITE_CONVEX_DEPLOYMENT_PROD,
  VITE_WORKOS_CLIENT_ID: import.meta.env.VITE_WORKOS_CLIENT_ID,
  VITE_WORKOS_REDIRECT_URI: import.meta.env.VITE_WORKOS_REDIRECT_URI,
  VITE_VERCEL_ENV: import.meta.env.VITE_VERCEL_ENV,
  VITE_VERCEL_URL: import.meta.env.VITE_VERCEL_URL,
  VITE_VERCEL_PROJECT_PRODUCTION_URL:
    import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL,
}

export const clientEnv = Object.freeze(parsePublicEnvironment(rawClientEnvironment))

export type ClientEnvironment = typeof clientEnv
