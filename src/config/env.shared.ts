import { z } from 'zod'

export const appEnvironmentSchema = z.enum(['dev', 'staging', 'prod'])
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>

const vercelEnvironmentSchema = z.enum(['development', 'preview', 'production'])
const workosCookieSameSiteSchema = z.enum(['lax', 'strict', 'none'])

const publicEnvironmentSchema = z.object({
  VITE_APP_ENV: appEnvironmentSchema,
  VITE_CONVEX_URL: z.string().url(),
  VITE_CONVEX_DEPLOYMENT_DEV: z.string().min(1),
  VITE_CONVEX_DEPLOYMENT_STAGING: z.string().min(1),
  VITE_CONVEX_DEPLOYMENT_PROD: z.string().min(1),
  VITE_WORKOS_CLIENT_ID: z.string().min(1),
  VITE_WORKOS_REDIRECT_URI: z.string().url(),
  VITE_VERCEL_ENV: vercelEnvironmentSchema.optional(),
  VITE_VERCEL_URL: z.string().min(1).optional(),
  VITE_VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
})

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_REDIRECT_URI: z.string().url(),
  WORKOS_COOKIE_PASSWORD: z.string().min(32),
  WORKOS_COOKIE_NAME: z.string().min(1).optional(),
  WORKOS_COOKIE_MAX_AGE: z.coerce.number().int().positive().optional(),
  WORKOS_COOKIE_DOMAIN: z.string().min(1).optional(),
  WORKOS_COOKIE_SAME_SITE: workosCookieSameSiteSchema.optional(),
})

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

function formatSchemaIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `- ${path}: ${issue.message}`
  })

  return [`${scope} validation failed:`, ...lines].join('\n')
}

function enforceStageRules<T extends PublicEnvironment>(environment: T): T {
  const issues: string[] = []

  if (
    environment.VITE_APP_ENV !== 'dev' &&
    environment.VITE_WORKOS_REDIRECT_URI.startsWith('http://')
  ) {
    issues.push('VITE_WORKOS_REDIRECT_URI must use https in staging/prod.')
  }

  if (
    environment.VITE_APP_ENV === 'staging' &&
    environment.VITE_VERCEL_ENV !== undefined &&
    environment.VITE_VERCEL_ENV !== 'preview'
  ) {
    issues.push('VITE_VERCEL_ENV must be preview when VITE_APP_ENV=staging.')
  }

  if (
    environment.VITE_APP_ENV === 'prod' &&
    environment.VITE_VERCEL_ENV !== undefined &&
    environment.VITE_VERCEL_ENV !== 'production'
  ) {
    issues.push('VITE_VERCEL_ENV must be production when VITE_APP_ENV=prod.')
  }

  if (issues.length > 0) {
    throw new Error(issues.join('\n'))
  }

  return environment
}

export function parsePublicEnvironment(raw: Record<string, unknown>): PublicEnvironment {
  const parsed = publicEnvironmentSchema.safeParse(raw)

  if (!parsed.success) {
    throw new Error(formatSchemaIssues('Public environment', parsed.error))
  }

  return enforceStageRules(parsed.data)
}

export function parseServerEnvironment(raw: Record<string, unknown>): ServerEnvironment {
  const parsed = serverEnvironmentSchema.safeParse(raw)

  if (!parsed.success) {
    throw new Error(formatSchemaIssues('Server environment', parsed.error))
  }

  const environment = enforceStageRules(parsed.data)
  const issues: string[] = []

  if (
    environment.VITE_APP_ENV !== 'dev' &&
    environment.WORKOS_REDIRECT_URI.startsWith('http://')
  ) {
    issues.push('WORKOS_REDIRECT_URI must use https in staging/prod.')
  }

  if (environment.VITE_WORKOS_CLIENT_ID !== environment.WORKOS_CLIENT_ID) {
    issues.push('WORKOS_CLIENT_ID must match VITE_WORKOS_CLIENT_ID.')
  }

  if (environment.VITE_WORKOS_REDIRECT_URI !== environment.WORKOS_REDIRECT_URI) {
    issues.push('WORKOS_REDIRECT_URI must match VITE_WORKOS_REDIRECT_URI.')
  }

  if (issues.length > 0) {
    throw new Error(issues.join('\n'))
  }

  return environment
}
