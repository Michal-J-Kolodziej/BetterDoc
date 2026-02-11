import { describe, expect, it } from 'vitest'

import { parsePublicEnvironment, parseServerEnvironment } from './env.shared'

const basePublicEnvironment = {
  VITE_APP_ENV: 'dev',
  VITE_CONVEX_URL: 'https://betterdoc-dev.convex.cloud',
  VITE_CONVEX_DEPLOYMENT_DEV: 'dev:betterdoc-dev',
  VITE_CONVEX_DEPLOYMENT_STAGING: 'staging:betterdoc-staging',
  VITE_CONVEX_DEPLOYMENT_PROD: 'prod:betterdoc-prod',
  VITE_WORKOS_CLIENT_ID: 'client_1234',
  VITE_WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  VITE_VERCEL_ENV: 'development',
  VITE_VERCEL_URL: 'localhost:3000',
  VITE_VERCEL_PROJECT_PRODUCTION_URL: 'betterdoc.example.com',
} as const

describe('parsePublicEnvironment', () => {
  it('accepts dev configuration', () => {
    const parsed = parsePublicEnvironment({ ...basePublicEnvironment })

    expect(parsed.VITE_APP_ENV).toBe('dev')
  })

  it('rejects staging when Vercel env is not preview', () => {
    expect(() =>
      parsePublicEnvironment({
        ...basePublicEnvironment,
        VITE_APP_ENV: 'staging',
        VITE_WORKOS_REDIRECT_URI: 'https://staging.betterdoc.app/auth/callback',
        VITE_VERCEL_ENV: 'production',
      }),
    ).toThrow(/VITE_VERCEL_ENV must be preview/)
  })
})

describe('parseServerEnvironment', () => {
  it('requires WORKOS_API_KEY outside dev', () => {
    expect(() =>
      parseServerEnvironment({
        ...basePublicEnvironment,
        VITE_APP_ENV: 'prod',
        VITE_WORKOS_REDIRECT_URI: 'https://betterdoc.app/auth/callback',
        VITE_VERCEL_ENV: 'production',
      }),
    ).toThrow(/WORKOS_API_KEY is required/)
  })

  it('accepts prod when all required variables are present', () => {
    const parsed = parseServerEnvironment({
      ...basePublicEnvironment,
      VITE_APP_ENV: 'prod',
      VITE_WORKOS_REDIRECT_URI: 'https://betterdoc.app/auth/callback',
      VITE_VERCEL_ENV: 'production',
      WORKOS_API_KEY: 'sk_live_123',
    })

    expect(parsed.VITE_APP_ENV).toBe('prod')
  })
})
