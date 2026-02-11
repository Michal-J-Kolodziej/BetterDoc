import { v } from 'convex/values'

import { query } from './_generated/server'

export const getStatus = query({
  args: {},
  returns: v.object({
    status: v.literal('ok'),
    deployment: v.string(),
    appEnvironment: v.union(v.literal('dev'), v.literal('staging'), v.literal('prod')),
  }),
  handler: async () => {
    const appEnvironment =
      (process.env.VITE_APP_ENV as 'dev' | 'staging' | 'prod' | undefined) ?? 'dev'

    const deploymentByEnvironment: Record<'dev' | 'staging' | 'prod', string> = {
      dev: process.env.VITE_CONVEX_DEPLOYMENT_DEV ?? '',
      staging: process.env.VITE_CONVEX_DEPLOYMENT_STAGING ?? '',
      prod: process.env.VITE_CONVEX_DEPLOYMENT_PROD ?? '',
    }

    return {
      status: 'ok' as const,
      deployment: deploymentByEnvironment[appEnvironment],
      appEnvironment,
    }
  },
})
