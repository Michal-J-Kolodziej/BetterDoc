import { parseServerEnvironment } from './env.shared'

const rawServerEnvironment: Record<string, unknown> = {
  VITE_APP_ENV: process.env.VITE_APP_ENV,
  VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
  VITE_CONVEX_DEPLOYMENT_DEV: process.env.VITE_CONVEX_DEPLOYMENT_DEV,
  VITE_CONVEX_DEPLOYMENT_STAGING: process.env.VITE_CONVEX_DEPLOYMENT_STAGING,
  VITE_CONVEX_DEPLOYMENT_PROD: process.env.VITE_CONVEX_DEPLOYMENT_PROD,
  VITE_WORKOS_CLIENT_ID: process.env.VITE_WORKOS_CLIENT_ID,
  VITE_WORKOS_REDIRECT_URI: process.env.VITE_WORKOS_REDIRECT_URI,
  VITE_VERCEL_ENV: process.env.VITE_VERCEL_ENV,
  VITE_VERCEL_URL: process.env.VITE_VERCEL_URL,
  VITE_VERCEL_PROJECT_PRODUCTION_URL: process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL,
  WORKOS_API_KEY: process.env.WORKOS_API_KEY,
}

export const serverEnv = Object.freeze(parseServerEnvironment(rawServerEnvironment))

export type ServerEnvironment = typeof serverEnv
