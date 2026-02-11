import { serverEnv } from './env.server'

export const workosServerConfig = Object.freeze({
  apiKey: serverEnv.WORKOS_API_KEY ?? null,
  clientId: serverEnv.VITE_WORKOS_CLIENT_ID,
  redirectUri: serverEnv.VITE_WORKOS_REDIRECT_URI,
})
