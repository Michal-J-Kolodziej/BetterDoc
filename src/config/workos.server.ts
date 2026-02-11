import { serverEnv } from './env.server'

export const workosServerConfig = Object.freeze({
  apiKey: serverEnv.WORKOS_API_KEY,
  clientId: serverEnv.WORKOS_CLIENT_ID,
  redirectUri: serverEnv.WORKOS_REDIRECT_URI,
  cookiePassword: serverEnv.WORKOS_COOKIE_PASSWORD,
  cookieName: serverEnv.WORKOS_COOKIE_NAME ?? 'wos-session',
  cookieMaxAge: serverEnv.WORKOS_COOKIE_MAX_AGE ?? 34560000,
  cookieDomain: serverEnv.WORKOS_COOKIE_DOMAIN ?? null,
  cookieSameSite: serverEnv.WORKOS_COOKIE_SAME_SITE ?? 'lax',
})
